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
  it: { titolo: 'Accedi a Work Balance', sotto: 'Bentornato: accedi per continuare.',
        insieme: 'Accedi o registrati', sottoInsieme: 'Se non hai un account, viene creato al primo accesso.',
        registra: 'Crea il tuo account', sottoRegistra: 'Bastano pochi secondi.' },
  en: { titolo: 'Sign in to Work Balance', sotto: 'Welcome back — sign in to continue.',
        insieme: 'Sign in or sign up', sottoInsieme: 'No account yet? One is created on your first sign-in.',
        registra: 'Create your account', sottoRegistra: 'It only takes a few seconds.' },
  es: { titolo: 'Entra en Work Balance', sotto: 'Bienvenido de nuevo: inicia sesión para continuar.',
        insieme: 'Entra o regístrate', sottoInsieme: 'Si no tienes cuenta, se crea al primer acceso.',
        registra: 'Crea tu cuenta', sottoRegistra: 'Solo lleva unos segundos.' },
  fr: { titolo: 'Connexion à Work Balance', sotto: 'Bon retour : connecte-toi pour continuer.',
        insieme: 'Se connecter ou s\'inscrire', sottoInsieme: 'Pas encore de compte ? Il est créé à la première connexion.',
        registra: 'Crée ton compte', sottoRegistra: 'Cela prend quelques secondes.' },
  de: { titolo: 'Bei Work Balance anmelden', sotto: 'Willkommen zurück — melde dich an, um fortzufahren.',
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
      if (stato.utente && stato.utente.id !== prima) {
        registraProfilo();
        sincronizza(true);
      }
    });

    notifica();
    if (stato.utente) {
      registraProfilo();
      sincronizza(true);
    }
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
    email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || '',
    username: u.username || ''
  };
}

/* Registra l'account nel database appena si entra.

   Gli account stanno su Clerk: senza questa riga il server verrebbe a sapere
   di una persona solo quando sincronizza il primo turno, e chi si registra
   senza usare l'applicazione resterebbe invisibile alla pagina di
   amministrazione. Email e id li riscrive il server leggendoli dal token:
   quello che mandiamo qui è solo il nome utente. */
async function registraProfilo() {
  if (!stato.supabase || !stato.utente) return;
  try {
    await stato.supabase.from('profili').upsert({
      user_id: stato.utente.id,
      username: stato.utente.username || '',
      ultimo_accesso: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch (err) {
    // Non è un motivo per impedire l'uso dell'applicazione.
  }
}

/* ---------------- accesso ---------------- */

/* Il componente di accesso vive dentro il sito, non in una finestra modale.

   La modale era comoda e sbagliata. In quella modalità il componente non ha
   un indirizzo proprio (`routing` è virtuale e non si può cambiare: il tipo
   della modale è letteralmente SignInProps senza le opzioni di routing), e
   ogni passaggio che ha bisogno di un ritorno — il rimbalzo di OAuth, la
   schermata dei campi mancanti — deve atterrare da qualche parte. Non
   trovando una nostra pagina, Clerk usa la sua: <dominio>.accounts.dev. Da
   lì la registrazione prosegue fuori dal sito, su un indirizzo che l'utente
   non riconosce, e che per giunta dichiara "Development mode".

   Con routing 'hash' il componente si tiene i suoi passaggi nel frammento
   dell'indirizzo — restiamo sul nostro dominio anche a metà iscrizione, e
   il ritorno da Google torna qui invece che sul portale.

   Il prezzo è che ora il frammento è suo: l'applicazione non lo usa per
   niente, e chi smonta il componente lo ripulisce.

   oauthFlow resta 'redirect'. Il popup era stato provato: va aperto sul clic,
   prima di sapere dove mandarlo, e con la verifica antibot di Cloudflare in
   mezzo restava su about:blank — uno schermo bianco al posto della scelta
   dell'account Google. */

/* L'indirizzo del sito senza frammento: è dove si torna a cose fatte. */
function paginaBase() {
  return window.location.origin + window.location.pathname + window.location.search;
}

function montaAccesso(nodo, registrazione) {
  if (!stato.clerk || !nodo) return false;
  const base = paginaBase();
  const comuni = {
    routing: 'hash',
    oauthFlow: 'redirect',
    signInUrl: base,
    signUpUrl: base,
    forceRedirectUrl: base,
    fallbackRedirectUrl: base
  };
  try {
    if (registrazione) {
      stato.clerk.mountSignUp(nodo, Object.assign({}, comuni, {
        signInForceRedirectUrl: base,
        signInFallbackRedirectUrl: base
      }));
    } else {
      // withSignUp tiene accesso e iscrizione nello stesso componente: senza,
      // chi entra con Google per la prima volta non ha ancora un account e il
      // tentativo verrebbe "trasferito" al flusso di iscrizione, cioè altrove.
      stato.clerk.mountSignIn(nodo, Object.assign({}, comuni, {
        withSignUp: true,
        signUpForceRedirectUrl: base,
        signUpFallbackRedirectUrl: base
      }));
    }
    stato.montato = registrazione ? 'registrazione' : 'accesso';
    return true;
  } catch (err) {
    stato.dettaglio = String(err && err.message || err).slice(0, 200);
    return false;
  }
}

function smontaAccesso(nodo) {
  if (!stato.clerk || !stato.montato || !nodo) { stato.montato = null; return; }
  try {
    if (stato.montato === 'registrazione') stato.clerk.unmountSignUp(nodo);
    else stato.clerk.unmountSignIn(nodo);
  } catch (err) {
    // Smontare un componente già sparito non è un problema da riportare.
  }
  stato.montato = null;
}

/* ---------------- funzioni sul server ---------------- */

/* Chiama una Edge Function con il token di Clerk.

   Non passa dal client di Supabase di proposito: quello parla con PostgREST,
   e qui serve una funzione, con i suoi codici di stato e il suo corpo di
   errore che l'interfaccia deve poter distinguere (quota esaurita non è un
   guasto e non va mostrato come tale). */
async function chiamaFunzione(nome, corpo) {
  if (!stato.clerk || !stato.utente) throw new Error('non-autenticato');
  const token = (await stato.clerk.session?.getToken()) ?? '';
  if (!token) throw new Error('non-autenticato');

  const risposta = await fetch(CFG.SUPABASE_URL + '/functions/v1/' + nome, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: CFG.SUPABASE_KEY,
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify(corpo || {})
  });

  let dati = null;
  try { dati = await risposta.json(); } catch (err) { /* corpo non JSON */ }
  if (!risposta.ok) {
    const e = new Error((dati && dati.errore) || ('http-' + risposta.status));
    e.dati = dati || {};
    throw e;
  }
  return dati;
}

/* Cancellazione completa: righe sul server, poi l'account.

   L'ordine conta. Le policy per riga concedono l'accesso in base al token:
   chiuso l'account il token non vale più e le righe resterebbero lì, senza
   più nessuno autorizzato a toglierle. Prima i dati, poi la porta.

   Il risultato è dettagliato apposta: "non è riuscito" senza dire quale
   pezzo costringerebbe a fidarsi, e su una cancellazione non ci si fida. */
async function eliminaTutto() {
  const esito = { righe: false, account: false, errore: null };

  if (stato.supabase && stato.utente) {
    const uid = stato.utente.id;
    try {
      for (const tabella of ['shifts', 'checkins', 'settings', 'punches', 'profili']) {
        const { error } = await stato.supabase.from(tabella).delete().eq('user_id', uid);
        if (error) throw new Error(tabella + ': ' + error.message);
      }
      esito.righe = true;
    } catch (err) {
      esito.errore = String(err && err.message || err);
      return esito;
    }
  } else {
    esito.righe = true;   // niente da cancellare sul server
  }

  try {
    // Richiede che nel pannello Clerk sia consentito eliminare il proprio
    // account; se non lo è, i dati sono già spariti e resta il solo profilo.
    if (stato.clerk && stato.clerk.user) await stato.clerk.user.delete();
    esito.account = true;
  } catch (err) {
    esito.errore = String(err && err.message || err);
  }

  Store.wipeTotale();
  stato.utente = null;
  notifica();
  return esito;
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
  montaAccesso,
  smontaAccesso,
  riprova,
  esci,
  eliminaTutto,
  chiamaFunzione,
  sincronizza
};

// Riallineamento quando si torna sulla scheda: l'app può aver timbrato nel frattempo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && stato.utente) sincronizza(true);
});

init();
