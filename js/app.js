/* app.js — avvio, routing fra le viste e gestione degli eventi. */
(function (global) {
  'use strict';

  var ctx = {
    view: 'dashboard',
    turniMonth: null,
    statsYear: null,
    quizOpen: false,
    quizAnswers: {},
    chat: [],
    aiBusy: false
  };

  var main, modal, modalBody, toastEl, deferredPrompt = null;

  /* ---------------- utilità ---------------- */

  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2600);
  }

  function applyTheme(tema) {
    document.documentElement.setAttribute('data-theme', tema === 'light' ? 'light' : 'dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tema === 'light' ? '#f4f6fa' : '#0e1116');
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  /* ---------------- rendering ---------------- */

  function render() {
    var sub = document.getElementById('topbar-sub');
    var titles = {
      dashboard: 'Turni, ore e benessere',
      turni: 'Registro dei turni',
      statistiche: 'Andamento nel tempo',
      benessere: 'Prevenzione di stress e burnout',
      impostazioni: 'Contratto, dati e app'
    };
    if (sub) sub.textContent = titles[ctx.view] || '';

    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.view === ctx.view);
      t.setAttribute('aria-selected', t.dataset.view === ctx.view ? 'true' : 'false');
    });

    var html = '';
    switch (ctx.view) {
      case 'turni': html = UI.turni(ctx); break;
      case 'statistiche': html = UI.statistiche(ctx); break;
      case 'benessere': html = UI.benessere(ctx); break;
      case 'impostazioni': html = UI.impostazioni(ctx); break;
      default: html = UI.dashboard(ctx);
    }
    main.innerHTML = html;

    var chat = document.getElementById('chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  function go(view) {
    ctx.view = view;
    if (view === 'turni' && !ctx.turniMonth) ctx.turniMonth = Calc.today();
    if (view === 'statistiche' && !ctx.statsYear) ctx.statsYear = Calc.fromISO(Calc.today()).getFullYear();
    if (view !== 'benessere') ctx.quizOpen = false;
    global.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  }

  /* ---------------- modale turno ---------------- */

  function openShiftForm(shift) {
    modalBody.innerHTML = UI.shiftForm(shift);
    updatePreview();
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', 'open');
  }

  function closeModal() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  function updatePreview() {
    var f = modalBody;
    var prev = f.querySelector('#preview-ore');
    if (!prev) return;
    var start = (f.querySelector('[name=start]') || {}).value;
    var end = (f.querySelector('[name=end]') || {}).value;
    var br = parseInt((f.querySelector('[name=breakMin]') || {}).value, 10) || 0;
    var min = Calc.shiftMinutes({ start: start, end: end, breakMin: br, tipo: 'lavoro' }, Store.settings());
    if (!min) { prev.textContent = ''; return; }
    var target = Store.settings().oreGiornaliere * 60;
    prev.textContent = 'Ore lavorate: ' + Calc.fmtDuration(min) +
      (target > 0 ? ' · ' + Calc.fmtPct((min / target) * 100) + ' del previsto' : '') +
      (Calc.parseTime(end) < Calc.parseTime(start) ? ' · turno a cavallo di mezzanotte' : '');
  }

  function submitShift(e) {
    e.preventDefault();
    var f = modalBody;
    var data = {
      id: f.querySelector('[name=id]').value || null,
      date: f.querySelector('[name=date]').value,
      tipo: f.querySelector('[name=tipo]').value,
      start: (f.querySelector('[name=start]') || {}).value || '',
      end: (f.querySelector('[name=end]') || {}).value || '',
      breakMin: (f.querySelector('[name=breakMin]') || {}).value || 0,
      note: (f.querySelector('[name=note]') || {}).value || ''
    };
    if (!data.date) { toast('Inserisci una data.'); return; }
    if (Calc.TIPI[data.tipo].conteggia === 'ore' && (!data.start || !data.end)) {
      toast('Inserisci orario di inizio e fine.');
      return;
    }
    if (data.start && data.end && data.start === data.end) {
      toast('Inizio e fine coincidono.');
      return;
    }
    Store.saveShift(data);
    closeModal();
    toast(data.id ? 'Turno aggiornato.' : 'Turno salvato.');
    render();
  }

  /* ---------------- IA ---------------- */

  function aiSend(text) {
    if (!text) return;
    ctx.chat.push({ role: 'user', content: text });
    ctx.aiBusy = true;
    render();

    AI.ask(ctx.chat).then(function (res) {
      ctx.chat.push({ role: 'assistant', content: res.text });
    }).catch(function (err) {
      ctx.chat.push({ role: 'assistant', content: 'Non sono riuscito a rispondere: ' + err.message });
    }).then(function () {
      ctx.aiBusy = false;
      render();
    });
  }

  /* ---------------- eventi ---------------- */

  function onClick(e) {
    var tab = e.target.closest('.tab');
    if (tab) { go(tab.dataset.view); return; }

    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;

    switch (action) {
      case 'goto':
        go(el.dataset.view);
        break;

      case 'new-shift':
        openShiftForm({ date: el.dataset.date || Calc.today() });
        break;

      /* --- timbratura --- */
      case 'punch-in':
        Store.startPunch();
        toast('Entrata registrata alle ' + Calc.timeFromMs(Date.now()) + '.');
        render();
        break;

      case 'punch-break': {
        var inPausa = Calc.punchTotals(Store.punch()).inPausa;
        Store.toggleBreak();
        toast(inPausa ? 'Pausa terminata.' : 'Pausa iniziata.');
        render();
        break;
      }

      case 'punch-out': {
        var turno = Store.stopPunch();
        if (turno) {
          var min = Calc.shiftMinutes(turno, Store.settings());
          toast('Uscita registrata: ' + Calc.fmtDuration(min) + ' (' + turno.start + '–' + turno.end + ').', 4000);
        }
        render();
        break;
      }

      case 'punch-cancel':
        if (global.confirm('Annullare la timbratura in corso senza registrare nulla?')) {
          Store.cancelPunch();
          toast('Timbratura annullata.');
          render();
        }
        break;

      case 'quick-standard': {
        var st = Store.settings();
        var o = st.orario || {};
        if (!o.inizio || !o.fine) { toast('Imposta prima l\'orario standard.'); break; }
        Store.saveShift({
          date: Calc.today(), start: o.inizio, end: o.fine,
          breakMin: st.pausaPredefinita, tipo: 'lavoro'
        });
        toast('Giornata standard registrata.');
        render();
        break;
      }

      /* --- GPS --- */
      case 'geo-capture':
        toast('Rilevo la posizione…');
        Geo.posizioneCorrente().then(function (pos) {
          Geo.set({ lat: pos.lat, lng: pos.lng });
          toast('Posizione salvata (precisione ' + Geo.fmtDist(pos.acc) + ').', 3500);
          Geo.sync();
          render();
        }).catch(function (err) {
          toast(err.message, 4500);
        });
        break;

      case 'geo-toggle': {
        var attiva = el.checked;
        if (!attiva) {
          Geo.set({ attivo: false });
          Geo.stop();
          toast('Rilevamento GPS disattivato.');
          render();
          break;
        }
        if (!Geo.supported()) { el.checked = false; toast('Questo browser non supporta la geolocalizzazione.', 4000); break; }
        if (!Geo.isSecure()) { el.checked = false; toast('Serve una connessione https per usare il GPS.', 4500); break; }
        Geo.chiediPermessoNotifiche().then(function () {
          return Geo.posizioneCorrente().catch(function () { return null; });
        }).then(function (pos) {
          var patch = { attivo: true };
          if (pos && Geo.cfg().lat === null) { patch.lat = pos.lat; patch.lng = pos.lng; }
          Geo.set(patch);
          Geo.sync();
          toast(Geo.cfg().lat === null
            ? 'Attivo. Salva la posizione del lavoro mentre sei sul posto.'
            : 'Rilevamento GPS attivo.', 4000);
          render();
        });
        break;
      }

      case 'geo-test':
        toast('Verifico…');
        Geo.posizioneCorrente().then(function (pos) {
          var c = Geo.cfg();
          var d = Geo.distanza(pos.lat, pos.lng, c.lat, c.lng);
          toast('Sei a ' + Geo.fmtDist(d) + ' dal punto salvato (raggio ' + c.raggio + ' m): ' +
            (d <= c.raggio ? 'dentro' : 'fuori') + '.', 5000);
        }).catch(function (err) {
          toast(err.message, 4500);
        });
        break;

      case 'edit-shift':
        openShiftForm(Store.getShift(el.dataset.id));
        break;

      case 'del-shift': {
        var s = Store.getShift(el.dataset.id);
        if (s && global.confirm('Eliminare il turno del ' + Calc.fmtDate(s.date, 'medium') + '?')) {
          Store.deleteShift(el.dataset.id);
          toast('Turno eliminato.');
          render();
        }
        break;
      }

      case 'close-modal':
        closeModal();
        break;

      case 'month':
        ctx.turniMonth = Calc.addMonths(ctx.turniMonth || Calc.today(), parseInt(el.dataset.delta, 10));
        render();
        break;

      case 'year':
        ctx.statsYear = (ctx.statsYear || Calc.fromISO(Calc.today()).getFullYear()) + parseInt(el.dataset.delta, 10);
        render();
        break;

      /* --- questionario --- */
      case 'start-quiz':
        ctx.quizOpen = true;
        ctx.quizAnswers = {};
        render();
        break;

      case 'cancel-quiz':
        ctx.quizOpen = false;
        ctx.quizAnswers = {};
        render();
        break;

      case 'answer':
        ctx.quizAnswers[el.dataset.q] = parseInt(el.dataset.v, 10);
        render();
        break;

      case 'save-quiz': {
        var scored = Coach.scoreAnswers(ctx.quizAnswers);
        var evalRes = Coach.evaluate(ctx.quizAnswers, Store.shifts(), Store.settings());
        Store.addCheckin({
          answers: ctx.quizAnswers,
          dims: scored.dims,
          score: evalRes.score,
          level: evalRes.level.label
        });
        ctx.quizOpen = false;
        ctx.quizAnswers = {};
        toast('Check-in salvato.');
        render();
        break;
      }

      /* --- IA --- */
      case 'ai-send': {
        var input = document.getElementById('ai-input');
        var v = input ? input.value.trim() : '';
        if (!v) { toast('Scrivi una domanda.'); break; }
        aiSend(v);
        break;
      }

      case 'ai-analyze':
        ctx.aiBusy = true;
        ctx.chat.push({ role: 'user', content: 'Analizza i miei dati di lavoro e l\'ultimo check-in.' });
        render();
        AI.analyze().then(function (res) {
          ctx.chat.push({ role: 'assistant', content: res.text });
        }).catch(function (err) {
          ctx.chat.push({ role: 'assistant', content: 'Non sono riuscito a rispondere: ' + err.message });
        }).then(function () {
          ctx.aiBusy = false;
          render();
        });
        break;

      case 'ai-clear':
        ctx.chat = [];
        render();
        break;

      case 'save-ai': {
        var key = (document.getElementById('ai-key') || {}).value || '';
        var model = (document.getElementById('ai-model') || {}).value || 'claude-opus-5';
        Store.setAi(key.trim(), model);
        toast(key.trim() ? 'Chiave salvata su questo dispositivo.' : 'Chiave rimossa.');
        render();
        break;
      }

      case 'clear-ai':
        Store.setAi('', Store.get().aiModel);
        ctx.chat = [];
        toast('Chiave rimossa.');
        render();
        break;

      /* --- account e sincronizzazione --- */
      case 'cloud-login': {
        var dlg = document.getElementById('clerk-modal');
        global.Cloud.apriAccesso();
        if (typeof dlg.showModal === 'function') dlg.showModal();
        break;
      }

      case 'close-clerk': {
        var dlg2 = document.getElementById('clerk-modal');
        if (typeof dlg2.close === 'function') dlg2.close();
        break;
      }

      case 'cloud-sync':
        toast('Sincronizzo…');
        global.Cloud.sincronizza().then(function (res) {
          if (!res) return;
          toast(res.errore
            ? 'Sincronizzazione non riuscita: ' + res.errore
            : 'Sincronizzato: ' + res.inviati + ' inviati, ' + res.ricevuti + ' ricevuti.', 3500);
          render();
        });
        break;

      case 'cloud-logout':
        if (global.confirm('Uscire dall\'account? I dati restano sul server e li ritrovi al prossimo accesso; da questo computer verranno rimossi.')) {
          global.Cloud.esci().then(function () {
            toast('Uscito dall\'account.');
            render();
          });
        }
        break;

      /* --- impostazioni --- */
      case 'toggle-day': {
        var g = parseInt(el.dataset.day, 10);
        var list = (Store.settings().giorniLavorativi || []).slice();
        var i = list.indexOf(g);
        if (i >= 0) list.splice(i, 1); else list.push(g);
        list.sort();
        Store.updateSettings({ giorniLavorativi: list });
        render();
        break;
      }

      case 'theme':
        Store.updateSettings({ tema: el.dataset.theme });
        applyTheme(el.dataset.theme);
        render();
        break;

      case 'export-json':
        download('percentage-backup-' + Calc.today() + '.json', Store.exportJSON(), 'application/json');
        toast('Backup esportato.');
        break;

      case 'export-csv':
        download('percentage-turni-' + Calc.today() + '.csv', Store.exportCSV(), 'text/csv');
        toast('CSV esportato.');
        break;

      case 'import':
        document.getElementById('import-file').click();
        break;

      case 'wipe':
        if (global.confirm('Cancellare tutti i turni e i check-in salvati? L\'operazione non è reversibile.')) {
          Store.wipe();
          toast('Dati cancellati.');
          render();
        }
        break;
    }
  }

  function onChange(e) {
    var el = e.target;

    if (el.dataset && el.dataset.geo) {
      var gk = el.dataset.geo;
      var gv;
      if (el.type === 'checkbox') gv = el.checked;
      else if (el.type === 'number') gv = parseInt(el.value, 10) || 0;
      else gv = el.value;
      var gp = {};
      gp[gk] = gv;
      Geo.set(gp);
      Geo.sync();
      toast('Impostazione aggiornata.');
      if (gk === 'raggio' || gk === 'dwell') Geo.render();
      return;
    }

    if (el.dataset && el.dataset.set) {
      var k = el.dataset.set;
      var patch = {};
      var val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number' || k === 'inizioSettimana' || k === 'arrotondamento') val = parseFloat(el.value) || 0;
      else val = el.value;

      if (k.indexOf('.') > 0) {           // es. "orario.inizio"
        var parti = k.split('.');
        var nested = Object.assign({}, Store.settings()[parti[0]] || {});
        nested[parti[1]] = val;
        patch[parti[0]] = nested;
      } else {
        patch[k] = val;
      }

      Store.updateSettings(patch);
      // L'orario standard ridefinisce le ore contrattuali: la vista va ridisegnata.
      if (k.indexOf('orario.') === 0 || k === 'pausaRetribuita') render();
      toast('Impostazione aggiornata.');
      return;
    }

    if (el.id === 'import-file' && el.files && el.files[0]) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var mode = global.confirm('OK = sostituisci i dati esistenti\nAnnulla = unisci ai dati attuali') ? 'replace' : 'merge';
          var n = Store.importJSON(reader.result, mode);
          toast('Importati: ' + n + ' turni in archivio.');
          render();
        } catch (err) {
          toast('File non valido: ' + err.message, 4000);
        }
      };
      reader.readAsText(el.files[0]);
      el.value = '';
    }
  }

  function onModalClick(e) {
    var chip = e.target.closest('#tipo-chips .chip');
    if (chip) {
      modalBody.querySelectorAll('#tipo-chips .chip').forEach(function (c) { c.classList.remove('on'); });
      chip.classList.add('on');
      modalBody.querySelector('[name=tipo]').value = chip.dataset.tipo;
      var fields = modalBody.querySelector('#ore-fields');
      if (fields) fields.classList.toggle('hidden', Calc.TIPI[chip.dataset.tipo].conteggia !== 'ore');
    }
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && e.target.id === 'ai-input') {
      e.preventDefault();
      var v = e.target.value.trim();
      if (v) aiSend(v);
    }
  }

  /* ---------------- cronometro ---------------- */

  var avvisoPausaDato = false;

  /* Aggiorna solo i nodi del cronometro: ridisegnare tutto ogni secondo
     farebbe perdere il focus ai campi di testo. */
  function tickPunch() {
    var p = Store.punch();
    var clock = document.getElementById('punch-clock');
    if (!p) { avvisoPausaDato = false; return; }

    var t = Calc.punchTotals(p);

    // Promemoria una tantum se la pausa resta aperta troppo a lungo.
    if (t.inPausa && !avvisoPausaDato && (Date.now() - t.pausaCorrenteDa) > 3 * 3600000) {
      avvisoPausaDato = true;
      Geo.notify('Pausa ancora aperta', 'La pausa è aperta da più di 3 ore: se hai finito il turno, timbra l\'uscita.', 'pausa-lunga');
    }
    if (!t.inPausa) avvisoPausaDato = false;

    if (!clock || ctx.view !== 'dashboard') return;

    var st = Store.settings();
    var giorno = Calc.daySummary(p.date, Store.shifts(), st);
    var target = giorno.target > 0 ? giorno.target : Math.round(st.oreGiornaliere * 60);
    var lavoroTot = giorno.worked + t.lavoro;
    var pct = target > 0 ? (lavoroTot / target) * 100 : 0;

    clock.textContent = UI.fmtClock(t.lavoroSec);
    var meter = document.getElementById('punch-meter');
    if (meter) meter.innerHTML = Charts.meter(pct, 'var(--accent)');
    var pctEl = document.getElementById('punch-pct');
    if (pctEl) pctEl.textContent = Calc.fmtPct(pct) + ' di ' + Calc.fmtDuration(target);
    var det = document.getElementById('punch-detail');
    if (det) det.innerHTML = UI.punchDetail(p, t, Calc.expectedEnd(p, st, Math.max(0, target - giorno.worked)));
  }

  /* ---------------- avvio ---------------- */

  function init() {
    main = document.getElementById('main');
    modal = document.getElementById('modal');
    modalBody = document.getElementById('modal-body');
    toastEl = document.getElementById('toast');

    Store.init();
    applyTheme(Store.settings().tema);

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', function (e) {
      if (modal.open && e.target.closest('#modal-body')) updatePreview();
    });
    document.addEventListener('keydown', onKeydown);
    modalBody.addEventListener('submit', submitShift);
    modalBody.addEventListener('click', onModalClick);

    document.getElementById('btn-theme').addEventListener('click', function () {
      var next = Store.settings().tema === 'light' ? 'dark' : 'light';
      Store.updateSettings({ tema: next });
      applyTheme(next);
      render();
    });

    global.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      document.getElementById('btn-install').classList.remove('hidden');
    });

    document.getElementById('btn-install').addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        document.getElementById('btn-install').classList.add('hidden');
      });
    });

    render();

    setInterval(tickPunch, 1000);
    Geo.sync();

    // Il modulo cloud si carica dopo (è un modulo ES): quando cambia stato,
    // la vista si aggiorna da sola.
    var attesaCloud = setInterval(function () {
      if (!global.Cloud) return;
      clearInterval(attesaCloud);
      global.Cloud.onChange(function () {
        if (ctx.view === 'impostazioni') render();
      });
    }, 300);
    setTimeout(function () { clearInterval(attesaCloud); }, 15000);

    // Rientrando nell'app: ridisegno (la data può essere cambiata) e riattivo il GPS.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        Geo.sync();
        render();
      }
    });

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service worker non registrato:', err);
      });

      // Quando una versione nuova prende il controllo, la pagina sta ancora
      // usando i file vecchi: la ricarico una volta sola, così l'aggiornamento
      // si vede subito invece che alla visita successiva.
      // Solo se un service worker c'era già: alla primissima visita
      // "controllerchange" segnala l'installazione, non un aggiornamento,
      // e i file in pagina sono comunque quelli giusti.
      var avevaControllo = !!navigator.serviceWorker.controller;
      var giaRicaricato = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!avevaControllo || giaRicaricato) return;
        giaRicaricato = true;
        location.reload();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.App = { ctx: ctx, render: render, go: go, toast: toast };
})(window);
