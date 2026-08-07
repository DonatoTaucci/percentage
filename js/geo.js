/* geo.js — timbratura automatica con GPS e notifiche.

   Limite tecnico da conoscere: una web app non può ricevere la posizione
   quando è completamente chiusa. Il rilevamento funziona mentre l'app è
   aperta (anche solo in background su Android, finché il sistema non
   sospende la scheda). Su iPhone Safari sospende la geolocalizzazione
   appena l'app va in secondo piano: lì il GPS serve come conferma rapida
   all'apertura, non come automatismo continuo.

   Per questo ogni automatismo è accompagnato da una notifica e resta
   sempre correggibile a mano. */
(function (global) {
  'use strict';

  var DEFAULT_GEO = {
    attivo: false,
    lat: null,
    lng: null,
    etichetta: '',
    raggio: 150,        // metri
    dwell: 90,          // secondi di permanenza prima di agire (anti-rimbalzo)
    autoEntrata: true,
    autoUscita: true,
    pausaAuto: true,
    notifiche: true
  };

  var watchId = null;
  var stato = {
    ultima: null,       // { lat, lng, acc, ts, dist }
    dentro: null,       // stato stabile corrente
    pending: null,      // { dentro, since }
    errore: null,
    ultimaAzione: null
  };

  function cfg() {
    return Object.assign({}, DEFAULT_GEO, Store.settings().geo || {});
  }

  function set(patch) {
    Store.updateSettings({ geo: Object.assign({}, cfg(), patch) });
  }

  function supported() {
    return !!(global.navigator && global.navigator.geolocation);
  }

  function isSecure() {
    return global.isSecureContext || location.hostname === 'localhost';
  }

  /* ---------- distanza ---------- */

  function distanza(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var toRad = function (v) { return v * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function fmtDist(m) {
    if (m === null || m === undefined) return '—';
    return m < 1000 ? m + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  /* ---------- notifiche ---------- */

  function notify(title, body, tag) {
    if (!cfg().notifiche) return;
    if (!('Notification' in global) || Notification.permission !== 'granted') return;
    var opts = { body: body, tag: tag || 'percentage', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    if (global.navigator.serviceWorker && global.navigator.serviceWorker.ready) {
      global.navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(title, opts);
      }).catch(function () {
        try { new Notification(title, opts); } catch (e) { /* ignorato */ }
      });
    } else {
      try { new Notification(title, opts); } catch (e) { /* ignorato */ }
    }
  }

  function chiediPermessoNotifiche() {
    if (!('Notification' in global)) return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    return Notification.requestPermission();
  }

  /* ---------- finestra pausa pranzo ---------- */

  /* Un'uscita in questa finestra viene letta come pausa, non come fine turno. */
  function inFinestraPausa(nowMs) {
    var o = Store.settings().orario || {};
    if (!o.pausaInizio || !o.pausaFine) return false;
    var d = new Date(nowMs);
    var min = d.getHours() * 60 + d.getMinutes();
    var a = Calc.parseTime(o.pausaInizio);
    var b = Calc.parseTime(o.pausaFine);
    if (a === null || b === null) return false;
    return min >= a - 75 && min <= b + 75;   // tolleranza di 75 minuti sui due lati
  }

  /* ---------- transizioni ---------- */

  function entrato() {
    var c = cfg();
    var p = Store.punch();

    if (!p) {
      if (!c.autoEntrata) {
        notify('Sei arrivato al lavoro', 'Apri Percentage per timbrare l\'entrata.', 'geo-in');
        return 'promemoria-entrata';
      }
      Store.startPunch();
      notify('Entrata registrata', 'Timbratura avviata alle ' + Calc.timeFromMs(Date.now()) + '.', 'geo-in');
      return 'entrata';
    }

    var t = Calc.punchTotals(p);
    if (t.inPausa) {
      Store.toggleBreak();
      notify('Pausa terminata', 'Rientro alle ' + Calc.timeFromMs(Date.now()) + ' · pausa di ' + Calc.fmtDuration(t.pausa) + '.', 'geo-break');
      return 'fine-pausa';
    }
    return null;
  }

  function uscito() {
    var c = cfg();
    var p = Store.punch();
    if (!p) return null;

    var t = Calc.punchTotals(p);
    if (t.inPausa) return null;   // già in pausa: nulla da fare

    if (c.pausaAuto && inFinestraPausa(Date.now())) {
      Store.toggleBreak();
      notify('Pausa iniziata', 'Uscita alle ' + Calc.timeFromMs(Date.now()) + '. Al rientro la pausa si chiude da sola.', 'geo-break');
      return 'inizio-pausa';
    }

    if (c.autoUscita) {
      var turno = Store.stopPunch();
      var min = Calc.shiftMinutes(turno, Store.settings());
      notify('Uscita registrata', 'Giornata di ' + Calc.fmtDuration(min) + ' (' + turno.start + '–' + turno.end + ').', 'geo-out');
      return 'uscita';
    }

    notify('Ti sei allontanato dal lavoro', 'La timbratura è ancora aperta: ricordati di uscire.', 'geo-out');
    return 'promemoria-uscita';
  }

  /* ---------- ciclo di rilevamento ---------- */

  function onPosition(pos) {
    var c = cfg();
    stato.errore = null;
    if (c.lat === null || c.lng === null) return;

    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    var acc = Math.round(pos.coords.accuracy || 0);
    var dist = distanza(lat, lng, c.lat, c.lng);
    stato.ultima = { lat: lat, lng: lng, acc: acc, ts: Date.now(), dist: dist };

    // Isteresi: per uscire serve superare il raggio più un margine,
    // così un errore di posizione non fa rimbalzare la timbratura.
    var margine = Math.max(30, Math.round(c.raggio * 0.35));
    var soglia = stato.dentro ? c.raggio + margine : c.raggio;
    var dentroOra = dist <= soglia;

    // Letture troppo imprecise non possono decidere una transizione.
    if (acc > 200 && stato.dentro !== null) { render(); return; }

    if (stato.dentro === null) {          // prima lettura: prende lo stato senza agire
      stato.dentro = dentroOra;
      stato.pending = null;
      render();
      return;
    }

    if (dentroOra === stato.dentro) {
      stato.pending = null;
      render();
      return;
    }

    // Cambio di stato: apro (o proseguo) la finestra di conferma. Con dwell a 0
    // la transizione è immediata già a questa lettura.
    if (!stato.pending || stato.pending.dentro !== dentroOra) {
      stato.pending = { dentro: dentroOra, since: Date.now() };
    }

    if (Date.now() - stato.pending.since >= c.dwell * 1000) {
      stato.dentro = dentroOra;
      stato.pending = null;
      var azione = dentroOra ? entrato() : uscito();
      if (azione) stato.ultimaAzione = { tipo: azione, ts: Date.now() };
      render();
      if (global.App && App.render) App.render();
      return;
    }

    render();
  }

  function onError(err) {
    var msg = 'Posizione non disponibile.';
    if (err && err.code === 1) msg = 'Permesso di posizione negato dal browser.';
    else if (err && err.code === 3) msg = 'Segnale GPS assente in questo momento.';
    stato.errore = msg;
    render();
  }

  function start() {
    if (!supported() || watchId !== null) return;
    watchId = global.navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 30000
    });
  }

  function stop() {
    if (watchId !== null) {
      global.navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    stato.dentro = null;
    stato.pending = null;
  }

  function sync() {
    var c = cfg();
    if (c.attivo && c.lat !== null && isSecure()) start();
    else stop();
  }

  /* Legge la posizione una sola volta. */
  function posizioneCorrente() {
    return new Promise(function (resolve, reject) {
      if (!supported()) return reject(new Error('Geolocalizzazione non supportata da questo browser.'));
      if (!isSecure()) return reject(new Error('Serve una connessione sicura (https) per usare il GPS.'));
      global.navigator.geolocation.getCurrentPosition(function (pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0) });
      }, function (err) {
        reject(new Error(err && err.code === 1 ? 'Permesso di posizione negato.' : 'Posizione non disponibile.'));
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
  }

  /* Aggiorna solo la riga di stato, senza ridisegnare tutta la pagina. */
  function render() {
    var el = document.getElementById('geo-status');
    if (el) el.outerHTML = statusHTML();
  }

  /* ---------- viste ---------- */

  function statusHTML() {
    var c = cfg();
    if (!c.attivo) return '<span id="geo-status" hidden></span>';

    var testo, tono = 'muted';
    if (stato.errore) { testo = stato.errore; tono = 'bad'; }
    else if (c.lat === null) { testo = 'Posizione del lavoro non ancora salvata.'; }
    else if (!stato.ultima) { testo = 'GPS attivo, in attesa del primo segnale…'; }
    else {
      testo = 'A ' + fmtDist(stato.ultima.dist) + ' dal lavoro · ' +
        (stato.dentro ? 'dentro il raggio' : 'fuori dal raggio') +
        ' · precisione ' + fmtDist(stato.ultima.acc);
      if (stato.pending) {
        var mancano = Math.max(0, Math.ceil((c.dwell * 1000 - (Date.now() - stato.pending.since)) / 1000));
        testo += ' · conferma ' + (stato.pending.dentro ? 'entrata' : 'uscita') + ' fra ' + mancano + 's';
        tono = 'warn';
      }
    }

    return '<div id="geo-status" class="geo-status ' + tono + '">' +
      '<span class="geo-dot"></span><span>' + testo + '</span></div>';
  }

  function settingsHTML() {
    var c = cfg();
    var esc = UI.esc;
    var html = '<div class="card" style="margin-top:14px"><div class="card-title">Timbratura automatica con GPS</div>';

    if (!supported()) {
      html += '<p class="small muted" style="margin:0">Questo browser non espone la geolocalizzazione.</p></div>';
      return html;
    }

    html += '<p class="small muted" style="margin:0 0 12px;max-width:66ch">' +
      'Salva la posizione del posto di lavoro: quando entri nel raggio la timbratura parte da sola, quando esci si chiude. ' +
      'Un\'uscita nella finestra della pausa pranzo viene registrata come pausa e si chiude al rientro. Ogni automatismo genera una notifica e resta correggibile a mano.</p>';

    html += '<label class="row" style="gap:10px;cursor:pointer;margin-bottom:12px">' +
      '<input type="checkbox" data-action="geo-toggle"' + (c.attivo ? ' checked' : '') + '>' +
      '<span class="small"><strong>Attiva il rilevamento</strong></span></label>';

    html += '<div class="row" style="gap:8px;margin-bottom:12px">';
    html += '<button class="btn sm" data-action="geo-capture">Usa la posizione attuale</button>';
    if (c.lat !== null) html += '<button class="btn sm ghost" data-action="geo-test">Verifica distanza</button>';
    html += '</div>';

    if (c.lat !== null) {
      html += '<p class="tiny muted" style="margin:0 0 12px">Posizione salvata: ' +
        c.lat.toFixed(5) + ', ' + c.lng.toFixed(5) +
        (c.etichetta ? ' · ' + esc(c.etichetta) : '') + '</p>';
    } else {
      html += '<p class="tiny muted" style="margin:0 0 12px">Nessuna posizione salvata: premi il pulsante mentre sei sul posto di lavoro.</p>';
    }

    html += '<div class="grid grid-2">';
    html += '<label class="field">Etichetta (facoltativa)' +
      '<input type="text" maxlength="40" data-geo="etichetta" value="' + esc(c.etichetta) + '" placeholder="Ufficio, cantiere, negozio…"></label>';
    html += '<label class="field">Raggio (metri)' +
      '<input type="number" min="50" max="2000" step="10" data-geo="raggio" value="' + c.raggio + '"></label>';
    html += '<label class="field">Conferma dopo (secondi)' +
      '<input type="number" min="0" max="600" step="15" data-geo="dwell" value="' + c.dwell + '"></label>';
    html += '</div>';

    html += '<div class="stack" style="margin-top:12px">';
    [
      ['autoEntrata', 'Timbra l\'entrata automaticamente quando arrivo'],
      ['autoUscita', 'Timbra l\'uscita automaticamente quando me ne vado'],
      ['pausaAuto', 'Registra come pausa le uscite nella finestra del pranzo'],
      ['notifiche', 'Mandami una notifica a ogni timbratura automatica']
    ].forEach(function (r) {
      html += '<label class="row" style="gap:10px;cursor:pointer">' +
        '<input type="checkbox" data-geo="' + r[0] + '"' + (c[r[0]] ? ' checked' : '') + '>' +
        '<span class="small">' + r[1] + '</span></label>';
    });
    html += '</div>';

    html += '<div class="note" style="margin-top:14px"><strong>Come funziona davvero.</strong> ' +
      'Un sito web riceve la posizione solo mentre è aperto: su Android il rilevamento prosegue anche con l\'app in secondo piano finché il sistema non sospende la scheda, ' +
      'su iPhone si interrompe quando esci dall\'app. In pratica: tieni Percentage aperta durante gli spostamenti di inizio e fine turno, ' +
      'oppure aprila all\'arrivo e alla partenza — bastano pochi secondi perché la timbratura si allinei. ' +
      'Il GPS consuma batteria: disattiva il rilevamento nei giorni liberi.</div>';

    if (c.attivo && !isSecure()) {
      html += '<div class="note" style="margin-top:10px;border-color:var(--bad)">Il GPS richiede una connessione sicura: pubblica l\'app in https (GitHub Pages, Netlify e Vercel lo fanno da soli).</div>';
    }

    html += '</div>';
    return html;
  }

  global.Geo = {
    DEFAULT_GEO: DEFAULT_GEO,
    cfg: cfg,
    set: set,
    supported: supported,
    isSecure: isSecure,
    start: start,
    stop: stop,
    sync: sync,
    stato: stato,
    distanza: distanza,
    fmtDist: fmtDist,
    posizioneCorrente: posizioneCorrente,
    chiediPermessoNotifiche: chiediPermessoNotifiche,
    notify: notify,
    statusHTML: statusHTML,
    settingsHTML: settingsHTML,
    render: render,
    // Esposta per i test: simula una lettura GPS senza dipendere dal browser.
    _onPosition: onPosition
  };
})(window);
