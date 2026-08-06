/* store.js — persistenza locale (localStorage) e stato dell'applicazione. */
(function (global) {
  'use strict';

  var KEY = 'percentage.v1';

  var DEFAULT_SETTINGS = {
    oreGiornaliere: 8,            // ore contrattuali per giorno lavorativo
    giorniLavorativi: [1, 2, 3, 4, 5], // 0 = domenica ... 6 = sabato
    pausaPredefinita: 60,         // minuti di pausa pranzo proposti nel form
    pausaRetribuita: false,       // se true la pausa conta come ore lavorate
    sogliaStraordinario: 8,       // ore oltre le quali scatta lo straordinario nel giorno
    maggiorazione: 25,            // % di maggiorazione sulle ore di straordinario
    pagaOraria: 0,                // 0 = disattiva i calcoli economici
    valuta: '€',
    oreMensiliFisse: 0,           // > 0 sostituisce il monte ore mensile calcolato
    inizioSettimana: 1,           // 1 = lunedì, 0 = domenica
    tema: 'dark'
  };

  var state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    shifts: [],       // { id, date, start, end, breakMin, tipo, note }
    checkins: [],     // { id, ts, answers:{}, score, level, dims:{} }
    aiKey: '',        // chiave API opzionale, salvata solo in locale
    aiModel: 'claude-opus-5'
  };

  var listeners = [];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data.settings) state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
      if (Array.isArray(data.shifts)) state.shifts = data.shifts;
      if (Array.isArray(data.checkins)) state.checkins = data.checkins;
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
      state.settings = Object.assign({}, state.settings, patch);
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
      commit();
      return clean;
    },

    deleteShift: function (id) {
      state.shifts = state.shifts.filter(function (s) { return s.id !== id; });
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
      commit();
      return entry;
    },

    deleteCheckin: function (id) {
      state.checkins = state.checkins.filter(function (c) { return c.id !== id; });
      commit();
    },

    /* --- IA opzionale --- */
    setAi: function (key, model) {
      state.aiKey = key || '';
      if (model) state.aiModel = model;
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
    }
  };

  global.Store = Store;
})(window);
