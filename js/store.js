/* store.js — persistenza locale (localStorage) e stato dell'applicazione. */
(function (global) {
  'use strict';

  var KEY = 'percentage.v1';

  var DEFAULT_SETTINGS = {
    // Orario standard: è la fonte di verità del monte ore giornaliero.
    orario: { inizio: '09:00', pausaInizio: '13:00', pausaFine: '14:00', fine: '18:00' },
    oreGiornaliere: 8,            // ricavato da "orario", non si modifica a mano
    pausaPredefinita: 60,         // ricavato da "orario"
    giorniLavorativi: [1, 2, 3, 4, 5], // 0 = domenica ... 6 = sabato
    pausaRetribuita: false,       // se true la pausa conta come ore lavorate
    sogliaStraordinario: 8,       // ore oltre le quali scatta lo straordinario nel giorno
    maggiorazione: 25,            // % di maggiorazione sulle ore di straordinario
    pagaOraria: 0,                // 0 = disattiva i calcoli economici
    valuta: '€',
    oreMensiliFisse: 0,           // > 0 sostituisce il monte ore mensile calcolato
    inizioSettimana: 1,           // 1 = lunedì, 0 = domenica
    arrotondamento: 1,            // minuti a cui arrotondare la timbratura
    geo: null,                    // rilevamento GPS, vedi geo.js
    tema: 'dark',
    /* Consensi, con la data in cui sono stati dati (null = mai dato).

       Stanno nelle impostazioni, quindi seguono l'account: chi acconsente
       dal telefono non se lo ritrova da rifare sul computer, e chi revoca
       revoca ovunque. La data serve a dimostrare quando è stato raccolto,
       che è metà di ciò che l'art. 7 GDPR chiede di poter provare. */
    consensi: {
      benessere: null,            // check-in: sono dati sulla salute (art. 9)
      ia: null                    // invio del riepilogo ad Anthropic
    }
  };

  // Coda di sincronizzazione: che cosa è cambiato in locale e non è ancora sul server.
  var EMPTY_SYNC = {
    lastPulledAt: null,
    dirtyShifts: [],
    dirtyCheckins: [],
    dirtySettings: false,
    dirtyPunch: false,
    deletedShifts: [],
    deletedCheckins: []
  };

  var state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    shifts: [],       // { id, date, start, end, breakMin, tipo, note }
    checkins: [],     // { id, ts, answers:{}, score, level, dims:{} }
    punch: null,      // timbratura in corso: { date, startedAt, pauses: [{from, to}] }
    sync: Object.assign({}, EMPTY_SYNC),
    aiKey: '',        // chiave API opzionale, salvata solo in locale
    aiModel: 'claude-opus-5'
  };

  function uniq(a) {
    return a.filter(function (v, i) { return a.indexOf(v) === i; });
  }

  function markSync(patch) {
    state.sync = Object.assign({}, state.sync, patch);
  }

  var listeners = [];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Minuti fra due orari 'HH:MM' (gestisce il passaggio di mezzanotte). */
  function diffMin(a, b) {
    function p(t) {
      var x = String(t || '').split(':');
      return (parseInt(x[0], 10) || 0) * 60 + (parseInt(x[1], 10) || 0);
    }
    var d = p(b) - p(a);
    if (d < 0) d += 24 * 60;
    return d;
  }

  /* L'orario standard determina ore giornaliere e pausa predefinita. */
  function derive(settings) {
    var o = settings.orario || DEFAULT_SETTINGS.orario;
    var pausa = (o.pausaInizio && o.pausaFine) ? diffMin(o.pausaInizio, o.pausaFine) : 0;
    var presenza = diffMin(o.inizio, o.fine);
    settings.pausaPredefinita = pausa;
    settings.oreGiornaliere = Math.max(0, (presenza - (settings.pausaRetribuita ? 0 : pausa))) / 60;
    // Copia sempre nuova: DEFAULT_SETTINGS è condiviso per riferimento e una
    // modifica in place lo trasformerebbe nel consenso di tutti.
    settings.consensi = Object.assign({ benessere: null, ia: null }, settings.consensi);
    return settings;
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data.settings) {
        state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
        // Archivi creati prima dell'orario standard: lo ricostruisco dalle ore già impostate.
        if (!data.settings.orario) {
          var ore = parseFloat(data.settings.oreGiornaliere);
          if (!isNaN(ore) && ore > 0) {
            var pausa = parseInt(data.settings.pausaPredefinita, 10) || 0;
            var fine = 9 * 60 + Math.round(ore * 60) + pausa;
            var hhmm = function (m) {
              m = ((Math.round(m) % 1440) + 1440) % 1440;
              return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
            };
            state.settings.orario = {
              inizio: '09:00',
              pausaInizio: pausa > 0 ? '13:00' : '',
              pausaFine: pausa > 0 ? hhmm(13 * 60 + pausa) : '',
              fine: hhmm(fine)
            };
          }
        }
        derive(state.settings);
      }
      if (Array.isArray(data.shifts)) state.shifts = data.shifts;
      if (Array.isArray(data.checkins)) state.checkins = data.checkins;
      if (data.punch && data.punch.startedAt) state.punch = data.punch;
      if (data.sync) state.sync = Object.assign({}, EMPTY_SYNC, data.sync);
      if (typeof data.aiKey === 'string') state.aiKey = data.aiKey;
      if (typeof data.aiModel === 'string') state.aiModel = data.aiModel;
    } catch (err) {
      console.warn('Dati locali illeggibili, riparto da zero.', err);
    }
  }

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Salvataggio non riuscito.', err);
    }
  }

  function emit() {
    listeners.forEach(function (fn) { fn(state); });
  }

  function commit() {
    save();
    emit();
  }

  var Store = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,

    init: function () { load(); return state; },
    get: function () { return state; },
    subscribe: function (fn) { listeners.push(fn); },

    settings: function () { return state.settings; },

    updateSettings: function (patch) {
      var prima = state.settings.oreGiornaliere;
      state.settings = Object.assign({}, state.settings, patch);
      derive(state.settings);
      // La soglia straordinario segue le ore contrattuali finché non viene toccata a mano.
      if (!('sogliaStraordinario' in patch) && Math.abs(state.settings.sogliaStraordinario - prima) < 0.01) {
        state.settings.sogliaStraordinario = state.settings.oreGiornaliere;
      }
      markSync({ dirtySettings: true });
      commit();
    },

    /* --- consensi ---

       Il consenso non è un interruttore qualsiasi: dev'essere un atto
       positivo, e deve poter essere ritirato con la stessa facilità con cui
       è stato dato (art. 7 GDPR). Da qui passano entrambe le direzioni. */
    consenso: function (nome) { return !!(state.settings.consensi || {})[nome]; },
    dataConsenso: function (nome) { return (state.settings.consensi || {})[nome] || null; },

    impostaConsenso: function (nome, dato) {
      var c = Object.assign({}, state.settings.consensi);
      c[nome] = dato ? new Date().toISOString() : null;
      Store.updateSettings({ consensi: c });
    },

    /* --- timbratura --- */
    punch: function () { return state.punch; },

    startPunch: function (atMs) {
      if (state.punch) return state.punch;
      var now = atMs || Date.now();
      state.punch = {
        date: Calc.toISO(new Date(now)),
        startedAt: now,
        pauses: []
      };
      markSync({ dirtyPunch: true });
      commit();
      return state.punch;
    },

    /* Apre o chiude la pausa in corso. */
    toggleBreak: function (atMs) {
      if (!state.punch) return null;
      var now = atMs || Date.now();
      var pauses = state.punch.pauses;
      var last = pauses[pauses.length - 1];
      if (last && !last.to) last.to = now;
      else pauses.push({ from: now, to: null });
      markSync({ dirtyPunch: true });
      commit();
      return state.punch;
    },

    /* Chiude la timbratura e la trasforma in un turno. */
    stopPunch: function (atMs, note) {
      if (!state.punch) return null;
      var now = atMs || Date.now();
      var p = state.punch;
      p.pauses.forEach(function (b) { if (!b.to) b.to = now; });

      var round = Math.max(1, parseInt(state.settings.arrotondamento, 10) || 1);
      var roundMs = round * 60000;
      var startR = Math.round(p.startedAt / roundMs) * roundMs;
      var endR = Math.round(now / roundMs) * roundMs;
      var pausaMin = p.pauses.reduce(function (acc, b) { return acc + (b.to - b.from); }, 0) / 60000;

      var shift = Store.saveShift({
        date: p.date,
        start: Calc.timeFromMs(startR),
        end: Calc.timeFromMs(endR),
        breakMin: Math.round(pausaMin / round) * round,
        tipo: 'lavoro',
        note: note || ''
      });

      state.punch = null;
      markSync({ dirtyPunch: true });
      commit();
      return shift;
    },

    cancelPunch: function () {
      state.punch = null;
      markSync({ dirtyPunch: true });
      commit();
    },

    /* --- turni --- */
    shifts: function () { return state.shifts; },

    shiftsBetween: function (fromISO, toISO) {
      return state.shifts.filter(function (s) {
        return s.date >= fromISO && s.date <= toISO;
      });
    },

    shiftsOn: function (iso) {
      return state.shifts.filter(function (s) { return s.date === iso; });
    },

    getShift: function (id) {
      return state.shifts.find(function (s) { return s.id === id; }) || null;
    },

    saveShift: function (shift) {
      var clean = {
        id: shift.id || uid(),
        date: shift.date,
        start: shift.start || '',
        end: shift.end || '',
        breakMin: Math.max(0, parseInt(shift.breakMin, 10) || 0),
        tipo: shift.tipo || 'lavoro',
        note: (shift.note || '').slice(0, 400)
      };
      var i = state.shifts.findIndex(function (s) { return s.id === clean.id; });
      if (i >= 0) state.shifts[i] = clean; else state.shifts.push(clean);
      state.shifts.sort(function (a, b) {
        if (a.date === b.date) return (a.start || '').localeCompare(b.start || '');
        return a.date < b.date ? -1 : 1;
      });
      markSync({ dirtyShifts: uniq(state.sync.dirtyShifts.concat([clean.id])) });
      commit();
      return clean;
    },

    deleteShift: function (id) {
      state.shifts = state.shifts.filter(function (s) { return s.id !== id; });
      markSync({
        deletedShifts: uniq(state.sync.deletedShifts.concat([id])),
        dirtyShifts: state.sync.dirtyShifts.filter(function (x) { return x !== id; })
      });
      commit();
    },

    /* --- check-in benessere --- */
    checkins: function () { return state.checkins; },

    lastCheckin: function () {
      if (!state.checkins.length) return null;
      return state.checkins[state.checkins.length - 1];
    },

    addCheckin: function (entry) {
      entry.id = uid();
      entry.ts = Date.now();
      state.checkins.push(entry);
      if (state.checkins.length > 200) state.checkins = state.checkins.slice(-200);
      markSync({ dirtyCheckins: uniq(state.sync.dirtyCheckins.concat([entry.id])) });
      commit();
      return entry;
    },

    deleteCheckin: function (id) {
      state.checkins = state.checkins.filter(function (c) { return c.id !== id; });
      markSync({
        deletedCheckins: uniq(state.sync.deletedCheckins.concat([id])),
        dirtyCheckins: state.sync.dirtyCheckins.filter(function (x) { return x !== id; })
      });
      commit();
    },

    /* --- IA opzionale --- */
    setAi: function (key, model) {
      state.aiKey = key || '';
      if (model) state.aiModel = model;
      commit();
    },

    /* --- sincronizzazione --- */

    syncState: function () { return state.sync; },

    /* Applica i turni arrivati dal server. Le modifiche locali non ancora
       inviate hanno la precedenza: verranno spinte al prossimo giro. */
    mergeShifts: function (righe, dirty) {
      var mappa = {};
      state.shifts.forEach(function (s) { mappa[s.id] = s; });
      var n = 0;
      righe.forEach(function (r) {
        if (dirty.indexOf(r.turno.id) >= 0) return;
        if (r.riga.deleted_at) delete mappa[r.turno.id];
        else mappa[r.turno.id] = r.turno;
        n++;
      });
      state.shifts = Object.keys(mappa).map(function (k) { return mappa[k]; }).sort(function (a, b) {
        if (a.date === b.date) return (a.start || '').localeCompare(b.start || '');
        return a.date < b.date ? -1 : 1;
      });
      commit();
      return n;
    },

    mergeCheckins: function (righe, dirty) {
      var mappa = {};
      state.checkins.forEach(function (c) { mappa[c.id] = c; });
      var n = 0;
      righe.forEach(function (r) {
        if (dirty.indexOf(r.checkin.id) >= 0) return;
        if (r.riga.deleted_at) delete mappa[r.checkin.id];
        else mappa[r.checkin.id] = r.checkin;
        n++;
      });
      state.checkins = Object.keys(mappa).map(function (k) { return mappa[k]; })
        .sort(function (a, b) { return a.ts - b.ts; });
      commit();
      return n;
    },

    applyRemoteSettings: function (remote) {
      if (!remote) return;
      state.settings = derive(Object.assign({}, DEFAULT_SETTINGS, remote));
      commit();
    },

    applyRemotePunch: function (punch) {
      state.punch = punch && punch.startedAt ? punch : null;
      commit();
    },

    /* Tutto inviato e ricevuto: la coda riparte pulita. */
    syncDone: function (isoServer) {
      state.sync = Object.assign({}, EMPTY_SYNC, { lastPulledAt: isoServer });
      commit();
    },

    /* --- import / export --- */
    exportJSON: function () {
      return JSON.stringify({
        app: 'percentage',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: state.settings,
        shifts: state.shifts,
        checkins: state.checkins
      }, null, 2);
    },

    exportCSV: function () {
      var head = 'data;tipo;inizio;fine;pausa_min;ore_lavorate;note';
      var rows = state.shifts.map(function (s) {
        var min = global.Calc.shiftMinutes(s, state.settings);
        return [
          s.date,
          s.tipo,
          s.start || '',
          s.end || '',
          s.breakMin,
          (min / 60).toFixed(2).replace('.', ','),
          '"' + String(s.note || '').replace(/"/g, '""') + '"'
        ].join(';');
      });
      return [head].concat(rows).join('\n');
    },

    importJSON: function (text, mode) {
      var data = JSON.parse(text);
      if (!data || !Array.isArray(data.shifts)) throw new Error('File non valido');
      if (mode === 'replace') {
        state.shifts = data.shifts;
        state.checkins = Array.isArray(data.checkins) ? data.checkins : [];
      } else {
        var seen = {};
        state.shifts.forEach(function (s) { seen[s.id] = true; });
        data.shifts.forEach(function (s) { if (!seen[s.id]) state.shifts.push(s); });
        if (Array.isArray(data.checkins)) {
          var seenC = {};
          state.checkins.forEach(function (c) { seenC[c.id] = true; });
          data.checkins.forEach(function (c) { if (!seenC[c.id]) state.checkins.push(c); });
        }
      }
      if (data.settings) state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
      state.shifts.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      state.checkins.sort(function (a, b) { return a.ts - b.ts; });
      commit();
      return state.shifts.length;
    },

    wipe: function () {
      state.shifts = [];
      state.checkins = [];
      commit();
    },

    /* Cancellazione vera, quella che si chiede esercitando un diritto: non
       restano né impostazioni, né timbratura aperta, né chiave dell'IA, né
       la coda di sincronizzazione. Il dispositivo torna come al primo avvio. */
    wipeTotale: function () {
      state.shifts = [];
      state.checkins = [];
      state.punch = null;
      state.sync = Object.assign({}, EMPTY_SYNC);
      state.aiKey = '';
      state.settings = derive(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
      try { global.localStorage.removeItem(KEY); } catch (e) { /* già via */ }
      commit();
    }
  };

  global.Store = Store;
})(window);
