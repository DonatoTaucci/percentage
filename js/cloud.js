/* cloud.js — account Clerk e sincronizzazione con lo stesso server dell'app.

   È un modulo ES separato dal resto del sito: le librerie arrivano da CDN e
   se non sono raggiungibili (offline, rete bloccata) l'app continua a
   funzionare in locale esattamente come prima. La sincronizzazione è un
   sovrappiù, non un requisito. */

const CFG = window.CONFIG || {};
const CLERK_URL = 'https://esm.sh/@clerk/clerk-js@5';
const SUPABASE_URL_LIB = 'https://esm.sh/@supabase/supabase-js@2';
const LOCALIZZAZIONI = 'https://esm.sh/@clerk/localizations@3';

/* Clerk ha le proprie traduzioni ufficiali; il titolo lo scriviamo noi perché
   quello predefinito nomina l'applicazione così com'è registrata su Clerk. */
const PACCHETTI = { it: 'itIT', en: 'enUS', es: 'esES', fr: 'frFR', de: 'deDE' };
/* Due titoli, non uno. In modalità "accedi o registrati" Clerk usa
   titleCombined al posto di title: sovrascrivendo solo il secondo restava
   in vista il nome dell'applicazione come registrata su Clerk. */
const TITOLI = {
  it: { titolo: 'Accedi a Percentage', sotto: 'Bentornato: accedi per continuare.',
        insieme: 'Accedi o registrati', sottoInsieme: 'Se non hai un account, viene creato al primo accesso.',
        registra: 'Crea il tuo account', sottoRegistra: 'Bastano pochi secondi.' },
  en: { titolo: 'Sign in to Percentage', sotto: 'Welcome back — sign in to continue.',
        insieme: 'Sign in or sign up', sottoInsieme: 'No account yet? One is created on your first sign-in.',
        registra: 'Create your account', sottoRegistra: 'It only takes a few seconds.' },
  es: { titolo: 'Entra en Percentage', sotto: 'Bienvenido de nuevo: inicia sesión para continuar.',
        insieme: 'Entra o regístrate', sottoInsieme: 'Si no tienes cuenta, se crea al primer acceso.',
        registra: 'Crea tu cuenta', sottoRegistra: 'Solo lleva unos segundos.' },
  fr: { titolo: 'Connexion à Percentage', sotto: 'Bon retour : connecte-toi pour continuer.',
        insieme: 'Se connecter ou s\'inscrire', sottoInsieme: 'Pas encore de compte ? Il est créé à la première connexion.',
        registra: 'Crée ton compte', sottoRegistra: 'Cela prend quelques secondes.' },
  de: { titolo: 'Bei Percentage anmelden', sotto: 'Willkommen zurück — melde dich an, um fortzufahren.',
        insieme: 'Anmelden oder registrieren', sottoInsieme: 'Noch kein Konto? Es wird bei der ersten Anmeldung angelegt.',
        registra: 'Konto erstellen', sottoRegistra: 'Das dauert nur ein paar Sekunden.' }
};

async function localizzazione(lingua) {
  const t = TITOLI[lingua] || TITOLI.it;
  let base = {};
  try {
    const mod = await import(/* @vite-ignore */ LOCALIZZAZIONI);
    base = mod[PACCHETTI[lingua]] || {};
  } catch (err) {
    // Senza il pacchetto Clerk resta in inglese: è un peggioramento, non un guasto.
  }
  const signIn = base.signIn || {};
  const signUp = base.signUp || {};
  return {
    ...base,
    signIn: {
      ...signIn,
      start: {
        ...(signIn.start || {}),
        title: t.titolo,
        subtitle: t.sotto,
        titleCombined: t.insieme,
        subtitleCombined: t.sottoInsieme
      }
    },
    signUp: {
      ...signUp,
      start: { ...(signUp.start || {}), title: t.registra, subtitle: t.sottoRegistra }
    }
  };
}

const stato = {
  disponibile: false,
  pronto: false,
  clerk: null,
  supabase: null,
  utente: null,
  errore: null,
  motivo: 'avvio',   // avvio | senza-chiave | irraggiungibile | ok
  dettaglio: null,
  sincronizzando: false,
  ultimaSync: null
};

const ascoltatori = [];
const notifica = () => ascoltatori.forEach(fn => fn(stato));

/* ---------------- avvio ---------------- */

/* Le librerie arrivano dalla rete, e la rete può non rispondere affatto:
   una richiesta che resta appesa lascerebbe il bottone di accesso su
   "Caricamento…" per sempre. Meglio arrendersi dopo qualche secondo e
   dirlo, così l'utente sa che il problema è la rete e non la sua app. */
const TIMEOUT_MS = 12000;

function conTimeout(promessa, messaggio) {
  let orologio;
  const scadenza = new Promise((_, rifiuta) => {
    orologio = setTimeout(() => rifiuta(new Error(messaggio)), TIMEOUT_MS);
  });
  return Promise.race([promessa, scadenza]).finally(() => clearTimeout(orologio));
}

async function init() {
  if (!CFG.CLERK_PUBLISHABLE_KEY || !CFG.SUPABASE_URL) {
    stato.errore = null;         // non è un errore: è semplicemente non configurato
    stato.motivo = 'senza-chiave';
    stato.pronto = true;
    notifica();
    return;
  }
  try {
    const [{ Clerk }, { createClient }] = await conTimeout(Promise.all([
      import(/* @vite-ignore */ CLERK_URL),
      import(/* @vite-ignore */ SUPABASE_URL_LIB)
    ]), 'librerie');

    const lingua = (window.I18n && window.I18n.lingua()) || 'it';
    const clerk = new Clerk(CFG.CLERK_PUBLISHABLE_KEY);
    stato.lingua = lingua;
    await conTimeout(clerk.load({
      afterSignOutUrl: window.location.href,
      localization: await localizzazione(lingua)
    }), 'clerk');
    stato.clerk = clerk;

    stato.supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
      accessToken: async () => (await clerk.session?.getToken()) ?? '',
      auth: { persistSession: false, autoRefreshToken: false }
    });

    stato.disponibile = true;
    stato.pronto = true;
    stato.motivo = 'ok';
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
    stato.motivo = 'irraggiungibile';
    stato.dettaglio = String(err && err.message || err).slice(0, 200);
    stato.pronto = true;
    notifica();
  }
}

/* Un nuovo tentativo dopo un errore di rete. Restituisce sempre una promessa
   risolta a caricamento finito, così chi chiama sa quando riprovare ad aprire
   la finestra di accesso. */
let inCorso = null;
function riprova() {
  if (stato.disponibile) return Promise.resolve(stato);
  if (!inCorso) {
    stato.errore = null;
    stato.pronto = false;
    stato.motivo = 'avvio';
    notifica();
    inCorso = init().finally(() => { inCorso = null; });
  }
  return inCorso.then(() => stato);
}

function riassuntoUtente(u) {
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || ''
  };
}

/* ---------------- accesso ---------------- */

/* Si usa la finestra di Clerk, non un riquadro nostro.

   Montare il componente dentro un <dialog> nostro sembrava più integrato, ma
   costringeva a inseguire con il CSS una card che ha misure proprie.

   Due opzioni tengono l'utente dentro il sito, ed entrambe servono:

   - withSignUp mette accesso e iscrizione nello stesso componente. Senza,
     chi entra con Google per la prima volta non ha ancora un account: Clerk
     "trasferisce" il tentativo al flusso di iscrizione, che in mancanza di
     una pagina nostra è quello ospitato su <dominio>.accounts.dev. È così
     che ci si ritrova sul portale di Clerk a metà registrazione.

   - oauthFlow 'popup' apre Google in una finestra a parte invece di
     portarci via e riportarci indietro. Il permesso di aprirla c'è perché
     parte da un clic dell'utente. */
async function apriAccesso() {
  if (!stato.clerk) return;
  stato.clerk.openSignIn({
    withSignUp: true,
    oauthFlow: 'popup',
    forceRedirectUrl: window.location.href,
    signUpForceRedirectUrl: window.location.href
  });
}

/* Ingresso esplicito alla registrazione.

   Con withSignUp la finestra di accesso crea l'account da sola quando
   l'indirizzo non esiste, ma non lo dice: chi arriva per la prima volta
   vede solo "Continua" e non ha modo di sapere che è anche il pulsante per
   iscriversi. Un secondo percorso, dichiarato, toglie il dubbio. */
async function apriRegistrazione() {
  if (!stato.clerk) return;
  stato.clerk.openSignUp({
    oauthFlow: 'popup',
    signInForceRedirectUrl: window.location.href,
    forceRedirectUrl: window.location.href
  });
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

/* La lingua di Clerk si fissa al caricamento: per cambiarla serve una nuova
   istanza. Lo facciamo solo a utente disconnesso — chi ha già una sessione
   aperta non deve vedersela ricreare sotto i piedi per un cambio di lingua. */
async function cambiaLingua(lingua) {
  if (!stato.clerk || stato.utente || stato.lingua === lingua) return;
  stato.clerk = null;
  stato.disponibile = false;
  stato.pronto = false;
  notifica();
  await init();
}

window.Cloud = {
  stato: () => stato,
  cambiaLingua,
  configurato: () => !!CFG.CLERK_PUBLISHABLE_KEY && !!CFG.SUPABASE_URL,
  connesso: () => !!stato.utente,
  onChange: fn => ascoltatori.push(fn),
  apriAccesso,
  apriRegistrazione,
  riprova,
  esci,
  sincronizza
};

// Riallineamento quando si torna sulla scheda: l'app può aver timbrato nel frattempo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && stato.utente) sincronizza(true);
});

init();
