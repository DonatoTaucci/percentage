/* admin.js — accesso di amministrazione ai dati di tutti gli utenti.

   Il permesso non è deciso qui. Le policy del database concedono la lettura e
   la scrittura sulle righe altrui solo a chi risulta nella tabella `admins`,
   e lo fanno confrontando l'email contenuta nel token. Questo file chiede al
   server se l'utente è amministratore e, in caso contrario, non mostra la
   scheda: è una comodità, non una difesa. Se qualcuno forzasse il controllo
   nel browser otterrebbe una pagina vuota e una sfilza di errori, perché il
   server continuerebbe a rispondere solo con le sue righe. */
(function (global) {
  'use strict';

  var TABELLE = {
    shifts: { chiave: 'id', etichetta: 'Turni' },
    checkins: { chiave: 'id', etichetta: 'Check-in' },
    settings: { chiave: 'user_id', etichetta: 'Impostazioni' },
    punches: { chiave: 'user_id', etichetta: 'Timbratura' }
  };

  var stato = {
    verificato: false,   // la domanda è già stata posta al server?
    admin: false,
    motivo: null,        // 'ok' | 'non-admin' | 'senza-email' | 'errore'
    errore: null,
    emailNelToken: null  // l'email che il server riceve davvero, se c'è
  };

  /* Legge i claim dal token, senza verificarne la firma: qui non si sta
     autorizzando nulla — quello lo fa il database — si sta solo guardando
     cosa il server riceve, per poterlo dire all'utente. */
  function claimsDelToken() {
    var c = global.Cloud && global.Cloud.stato();
    var sessione = c && c.clerk && c.clerk.session;
    if (!sessione) return Promise.resolve(null);
    return sessione.getToken().then(function (jwt) {
      if (!jwt) return null;
      var parte = String(jwt).split('.')[1];
      if (!parte) return null;
      var json = atob(parte.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json)));
    }).catch(function () { return null; });
  }

  function sb() {
    var c = global.Cloud && global.Cloud.stato();
    return (c && c.supabase) || null;
  }

  /* Chiede al server se chi sta guardando è amministratore.

     Distinguiamo "non sei amministratore" da "il token non porta l'email":
     il secondo caso si risolve in un pannello, non riprovando, e senza dirlo
     si finirebbe a cercare l'errore nel posto sbagliato. */
  function verifica() {
    var s = sb();
    if (!s || !global.Cloud.connesso()) {
      stato.verificato = true;
      stato.admin = false;
      stato.motivo = 'non-admin';
      return Promise.resolve(false);
    }
    return Promise.all([s.rpc('is_admin'), claimsDelToken()]).then(function (out) {
      var r = out[0];
      stato.emailNelToken = (out[1] && out[1].email) || null;
      stato.verificato = true;
      if (r.error) {
        stato.admin = false;
        stato.motivo = 'errore';
        stato.errore = r.error.message;
        return false;
      }
      stato.admin = r.data === true;
      stato.motivo = stato.admin ? 'ok' : (stato.emailNelToken ? 'non-admin' : 'senza-email');
      return stato.admin;
    }).catch(function (err) {
      stato.verificato = true;
      stato.admin = false;
      stato.motivo = 'errore';
      stato.errore = String(err && err.message || err);
      return false;
    });
  }

  /* Se il token non porta l'email, nessuno può risultare amministratore.
     Lo si capisce confrontando l'email che Clerk conosce nel browser con
     l'esito del server: conosciuta di qua, negata di là. */
  function diagnosi() {
    var utente = global.Cloud && global.Cloud.stato().utente;
    if (!utente) return T('Serve l\'accesso.');
    if (stato.motivo === 'errore') return stato.errore;
    if (stato.admin) return null;
    if (!stato.emailNelToken) {
      // Distinzione che vale il tempo di scriverla: senza email nel token
      // nessuno può risultare amministratore, e la soluzione è in un pannello,
      // non nel riprovare.
      return T('Il token di accesso non contiene l\'email, quindi il server non può riconoscere nessun amministratore. Su Clerk, in Sessions → Customize session token, aggiungi il claim "email", poi esci e rientra.');
    }
    return T('Il server riceve {email}, che non è fra gli amministratori. L\'elenco si modifica nella tabella "admins" dal pannello Supabase.', { email: stato.emailNelToken });
  }

  function utenti() {
    var s = sb();
    if (!s) return Promise.resolve([]);
    return s.from('admin_utenti').select('*').order('ultima_attivita', { ascending: false })
      .then(function (r) {
        if (r.error) throw new Error(r.error.message);
        return r.data || [];
      });
  }

  function dati(userId) {
    var s = sb();
    if (!s) return Promise.resolve(null);
    return Promise.all([
      s.from('shifts').select('*').eq('user_id', userId).order('date', { ascending: false }),
      s.from('checkins').select('*').eq('user_id', userId).order('ts', { ascending: false }),
      s.from('settings').select('*').eq('user_id', userId).maybeSingle(),
      s.from('punches').select('*').eq('user_id', userId).maybeSingle()
    ]).then(function (r) {
      r.forEach(function (x) { if (x.error) throw new Error(x.error.message); });
      return {
        userId: userId,
        shifts: r[0].data || [],
        checkins: r[1].data || [],
        settings: r[2].data || null,
        punch: r[3].data || null
      };
    });
  }

  /* Salvataggio. updated_at viene riscritto sempre: è quello che fa capire
     ai due client che la riga è cambiata e va riscaricata. Senza, una
     modifica fatta da qui resterebbe invisibile sul telefono dell'utente. */
  function salva(tabella, riga) {
    var s = sb();
    var def = TABELLE[tabella];
    if (!s || !def) return Promise.reject(new Error('Tabella sconosciuta: ' + tabella));
    var payload = Object.assign({}, riga, { updated_at: new Date().toISOString() });
    return s.from(tabella).upsert(payload, { onConflict: def.chiave }).then(function (r) {
      if (r.error) throw new Error(r.error.message);
      return true;
    });
  }

  /* Cancellazione definitiva, non la lapide usata dalla sincronizzazione:
     qui si sta facendo pulizia, non si sta propagando una modifica. */
  function elimina(tabella, valoreChiave) {
    var s = sb();
    var def = TABELLE[tabella];
    if (!s || !def) return Promise.reject(new Error('Tabella sconosciuta: ' + tabella));
    return s.from(tabella).delete().eq(def.chiave, valoreChiave).then(function (r) {
      if (r.error) throw new Error(r.error.message);
      return true;
    });
  }

  global.Admin = {
    TABELLE: TABELLE,
    stato: function () { return stato; },
    verifica: verifica,
    diagnosi: diagnosi,
    utenti: utenti,
    dati: dati,
    salva: salva,
    elimina: elimina
  };
})(window);
