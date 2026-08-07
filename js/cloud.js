/* cloud.js — account Clerk e sincronizzazione con lo stesso server dell'app.

   È un modulo ES separato dal resto del sito: le librerie arrivano da CDN e
   se non sono raggiungibili (offline, rete bloccata) l'app continua a
   funzionare in locale esattamente come prima. La sincronizzazione è un
   sovrappiù, non un requisito. */

const CFG = window.CONFIG || {};
const CLERK_URL = 'https://esm.sh/@clerk/clerk-js@5';
const SUPABASE_URL_LIB = 'https://esm.sh/@supabase/supabase-js@2';

const stato = {
  disponibile: false,
  pronto: false,
  clerk: null,
  supabase: null,
  utente: null,
  errore: null,
  sincronizzando: false,
  ultimaSync: null
};

const ascoltatori = [];
const notifica = () => ascoltatori.forEach(fn => fn(stato));

/* ---------------- avvio ---------------- */

async function init() {
  if (!CFG.CLERK_PUBLISHABLE_KEY || !CFG.SUPABASE_URL) {
    stato.errore = null;         // non è un errore: è semplicemente non configurato
    notifica();
    return;
  }
  try {
    const [{ Clerk }, { createClient }] = await Promise.all([
      import(/* @vite-ignore */ CLERK_URL),
      import(/* @vite-ignore */ SUPABASE_URL_LIB)
    ]);

    const clerk = new Clerk(CFG.CLERK_PUBLISHABLE_KEY);
    await clerk.load({ afterSignOutUrl: window.location.href });
    stato.clerk = clerk;

    stato.supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
      accessToken: async () => (await clerk.session?.getToken()) ?? '',
      auth: { persistSession: false, autoRefreshToken: false }
    });

    stato.disponibile = true;
    stato.pronto = true;
    stato.utente = clerk.user ? riassuntoUtente(clerk.user) : null;

    clerk.addListener(({ user }) => {
      const prima = stato.utente?.id ?? null;
      stato.utente = user ? riassuntoUtente(user) : null;
      notifica();
      if (stato.utente && stato.utente.id !== prima) sincronizza(true);
    });

    notifica();
    if (stato.utente) sincronizza(true);
  } catch (err) {
    stato.errore = 'Servizio di accesso non raggiungibile: l\'app resta utilizzabile in locale.';
    stato.pronto = true;
    notifica();
  }
}

function riassuntoUtente(u) {
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || ''
  };
}

/* ---------------- accesso ---------------- */

async function apriAccesso() {
  if (!stato.clerk) return;
  const contenitore = document.getElementById('clerk-slot');
  if (!contenitore) return;
  contenitore.innerHTML = '';
  stato.clerk.mountSignIn(contenitore, { forceRedirectUrl: window.location.href });
}

async function esci() {
  if (!stato.clerk) return;
  await sincronizza(true);
  await stato.clerk.signOut();
  Store.wipe();
  stato.utente = null;
  notifica();
}

/* ---------------- conversioni ---------------- */

const rigaATurno = r => ({
  id: r.id, date: r.date, start: r.start_time || '', end: r.end_time || '',
  breakMin: r.break_min || 0, tipo: r.tipo || 'lavoro', note: r.note || ''
});

const turnoARiga = s => ({
  id: s.id, date: s.date, start_time: s.start, end_time: s.end,
  break_min: s.breakMin, tipo: s.tipo, note: s.note, deleted_at: null
});

const rigaACheckin = r => ({
  id: r.id, ts: Number(r.ts), answers: r.answers || {},
  dims: r.dims || {}, score: r.score || 0, level: r.level || ''
});

const checkinARiga = c => ({
  id: c.id, ts: c.ts, answers: c.answers, dims: c.dims,
  score: c.score, level: c.level, deleted_at: null
});

/* ---------------- sincronizzazione ---------------- */

async function sincronizza(silenzioso) {
  if (!stato.supabase || !stato.utente || stato.sincronizzando) return null;
  stato.sincronizzando = true;
  if (!silenzioso) notifica();

  const sb = stato.supabase;
  const sync = Store.syncState();
  const dati = Store.get();
  let inviati = 0, ricevuti = 0;

  try {
    /* push */
    const turniDaInviare = dati.shifts.filter(s => sync.dirtyShifts.includes(s.id));
    if (turniDaInviare.length) {
      const { error } = await sb.from('shifts').upsert(turniDaInviare.map(turnoARiga));
      if (error) throw error;
      inviati += turniDaInviare.length;
    }
    if (sync.deletedShifts.length) {
      const { error } = await sb.from('shifts')
        .update({ deleted_at: new Date().toISOString() }).in('id', sync.deletedShifts);
      if (error) throw error;
      inviati += sync.deletedShifts.length;
    }
    const checkinDaInviare = dati.checkins.filter(c => sync.dirtyCheckins.includes(c.id));
    if (checkinDaInviare.length) {
      const { error } = await sb.from('checkins').upsert(checkinDaInviare.map(checkinARiga));
      if (error) throw error;
      inviati += checkinDaInviare.length;
    }
    if (sync.deletedCheckins.length) {
      const { error } = await sb.from('checkins')
        .update({ deleted_at: new Date().toISOString() }).in('id', sync.deletedCheckins);
      if (error) throw error;
      inviati += sync.deletedCheckins.length;
    }
    if (sync.dirtySettings) {
      const { error } = await sb.from('settings').upsert({ data: dati.settings }, { onConflict: 'user_id' });
      if (error) throw error;
      inviati++;
    }
    if (sync.dirtyPunch) {
      const { error } = await sb.from('punches')
        .upsert({ punch: dati.punch || null, device: 'web' }, { onConflict: 'user_id' });
      if (error) throw error;
      inviati++;
    }

    /* pull */
    const since = sync.lastPulledAt || '1970-01-01T00:00:00Z';

    const { data: turni, error: e1 } = await sb.from('shifts').select('*').gt('updated_at', since);
    if (e1) throw e1;
    if (turni && turni.length) {
      ricevuti += Store.mergeShifts(turni.map(r => ({ riga: r, turno: rigaATurno(r) })), sync.dirtyShifts);
    }

    const { data: checkins, error: e2 } = await sb.from('checkins').select('*').gt('updated_at', since);
    if (e2) throw e2;
    if (checkins && checkins.length) {
      ricevuti += Store.mergeCheckins(checkins.map(r => ({ riga: r, checkin: rigaACheckin(r) })), sync.dirtyCheckins);
    }

    if (!sync.dirtySettings) {
      const { data: imp, error: e3 } = await sb.from('settings').select('*').gt('updated_at', since).limit(1);
      if (e3) throw e3;
      if (imp && imp.length) { Store.applyRemoteSettings(imp[0].data); ricevuti++; }
    }

    if (!sync.dirtyPunch) {
      const { data: pun, error: e4 } = await sb.from('punches').select('*').gt('updated_at', since).limit(1);
      if (e4) throw e4;
      if (pun && pun.length) { Store.applyRemotePunch(pun[0].punch || null); ricevuti++; }
    }

    Store.syncDone(new Date().toISOString());
    stato.ultimaSync = Date.now();
    stato.errore = null;
  } catch (err) {
    stato.errore = err?.message || 'Sincronizzazione non riuscita.';
  }

  stato.sincronizzando = false;
  notifica();
  return { inviati, ricevuti, errore: stato.errore };
}

/* ---------------- API pubblica ---------------- */

window.Cloud = {
  stato: () => stato,
  configurato: () => !!CFG.CLERK_PUBLISHABLE_KEY && !!CFG.SUPABASE_URL,
  connesso: () => !!stato.utente,
  onChange: fn => ascoltatori.push(fn),
  apriAccesso,
  esci,
  sincronizza
};

// Riallineamento quando si torna sulla scheda: l'app può aver timbrato nel frattempo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && stato.utente) sincronizza(true);
});

init();
