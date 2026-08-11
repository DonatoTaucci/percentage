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
    toastEl.textContent = T(msg);
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

  /* ---------------- accesso obbligatorio ----------------

     Il sito si apre sulla presentazione e mostra l'applicazione solo a chi
     ha effettuato l'accesso. Un'eccezione: chi è già entrato almeno una
     volta su questo dispositivo può proseguire anche quando il servizio di
     accesso non risponde. Senza quella deroga un'applicazione installabile
     e dichiaratamente utilizzabile offline smetterebbe di funzionare al
     primo problema di rete, che è il momento in cui serve di più. */

  var CHIAVE_ACCESSO = 'percentage.giaAccesso';

  function giaAccesso() {
    try { return localStorage.getItem(CHIAVE_ACCESSO) === '1'; } catch (e) { return false; }
  }
  function segnaAccesso() {
    try { localStorage.setItem(CHIAVE_ACCESSO, '1'); } catch (e) { /* ignorato */ }
  }

  function statoAccesso() {
    var cloud = global.Cloud;
    if (!cloud || !cloud.configurato()) {
      // Senza configurazione non c'è nessun accesso da chiedere: sarebbe una
      // porta chiusa senza serratura. Si entra, in locale.
      return { entra: true, motivo: 'non-configurato' };
    }
    var st = cloud.stato();
    if (st.utente) return { entra: true, motivo: 'autenticato' };
    if (ctx.offlineForzato && giaAccesso()) return { entra: true, motivo: 'offline' };
    return {
      entra: false,
      pronto: st.pronto,
      errore: st.motivo === 'irraggiungibile' ? st.errore : null,
      giaAccesso: st.motivo === 'irraggiungibile' && giaAccesso()
    };
  }

  function renderGate() {
    var landing = document.getElementById('landing');
    var app = document.getElementById('app');
    var s = statoAccesso();

    if (s.entra) {
      landing.classList.add('hidden');
      landing.innerHTML = '';
      app.classList.remove('hidden');
      render();
    } else {
      app.classList.add('hidden');
      landing.classList.remove('hidden');
      // L'informativa si legge anche da qui: chi deve decidere se registrarsi
      // ha il diritto di sapere prima che cosa succede ai suoi dati.
      landing.innerHTML = ctx.docLanding ? UI.documenti(ctx, true) : UI.landing(s);
      I18n.traduciDOM(landing);
    }
    return s.entra;
  }

  /* ---------------- rendering ---------------- */

  function render() {
    if (document.getElementById('app').classList.contains('hidden')) return;

    var sub = document.getElementById('topbar-sub');
    var titles = {
      dashboard: T('Turni, ore e benessere'),
      turni: T('Registro dei turni'),
      statistiche: T('Andamento nel tempo'),
      benessere: T('Prevenzione di stress e burnout'),
      impostazioni: T('Contratto, dati e app'),
      admin: T('Tutti gli utenti e i loro dati'),
      privacy: T('Dati personali e intelligenza artificiale')
    };
    if (sub) sub.textContent = titles[ctx.view] || '';

    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.view === ctx.view);
      t.setAttribute('aria-selected', t.dataset.view === ctx.view ? 'true' : 'false');
    });

    var html = '';
    switch (ctx.view) {
      case 'privacy': html = UI.documenti(ctx, false); break;
      case 'turni': html = UI.turni(ctx); break;
      case 'statistiche': html = UI.statistiche(ctx); break;
      case 'benessere': html = UI.benessere(ctx); break;
      case 'impostazioni': html = UI.impostazioni(ctx); break;
      case 'admin': html = UI.amministrazione(ctx); break;
      default: html = UI.dashboard(ctx);
    }
    main.innerHTML = html;
    I18n.traduciDOM(main);

    var chat = document.getElementById('chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  function go(view) {
    ctx.view = view;
    if (view === 'admin' && !ctx.adminUtenti) caricaUtentiAdmin();
    if (view === 'turni' && !ctx.turniMonth) ctx.turniMonth = Calc.today();
    if (view === 'statistiche' && !ctx.statsYear) ctx.statsYear = Calc.fromISO(Calc.today()).getFullYear();
    if (view !== 'benessere') ctx.quizOpen = false;
    global.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  }

  /* ---------------- modale turno ---------------- */

  function openShiftForm(shift) {
    modalBody.innerHTML = UI.shiftForm(shift);
    I18n.traduciDOM(modalBody);
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
    if (Calc.turnoIncompleto({ start: start, end: end, tipo: 'lavoro' })) {
      prev.textContent = start
        ? T('Manca l\'orario di uscita: il turno resta da completare e non conta ore.')
        : T('Manca l\'orario di entrata: il turno resta da completare e non conta ore.');
      I18n.traduciDOM(prev);
      return;
    }
    var min = Calc.shiftMinutes({ start: start, end: end, breakMin: br, tipo: 'lavoro' }, Store.settings());
    if (!min) { prev.textContent = ''; return; }
    var target = Store.settings().oreGiornaliere * 60;
    // Tradotto pezzo per pezzo: la durata composta ("8h 30m") produrrebbe una
    // chiave diversa per ogni orario, e nessuna sarebbe nel dizionario.
    var parti = [T('Ore lavorate: {ore}', { ore: Calc.fmtDuration(min) })];
    if (target > 0) parti.push(T('{pct} del previsto', { pct: Calc.fmtPct((min / target) * 100) }));
    if (Calc.parseTime(end) < Calc.parseTime(start)) parti.push(T('turno a cavallo di mezzanotte'));
    prev.textContent = parti.join(' · ');
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
    // Basta uno dei due orari: chi ha dimenticato di timbrare registra quello
    // che ha e completa più avanti. Finché manca l'altro il turno vale zero.
    if (Calc.TIPI[data.tipo].conteggia === 'ore' && !data.start && !data.end) {
      toast('Inserisci almeno l\'orario di entrata o quello di uscita.');
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
    // Ultimo controllo prima di uscire dal dispositivo: nascondere il pannello
    // non basta, ciò che conta è che senza consenso non parta la richiesta.
    if (!Store.consenso('ia')) { toast('Serve prima il tuo consenso all\'uso dell\'IA.'); return; }
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

  /* ---------------- cancellazione dell'account ----------------

     Due conferme, non una. La prima è la domanda, la seconda chiede di
     scrivere una parola: è l'unico modo per distinguere "voglio cancellare
     tutto" da un dito finito sul pulsante sbagliato. */

  function eliminaAccount() {
    if (!global.Cloud || !global.Cloud.connesso()) { toast('Nessun account collegato.'); return; }
    if (!global.confirm(T('Stai per eliminare definitivamente il tuo account, i turni sul server e quelli su questo dispositivo. Non è reversibile. Vuoi continuare?'))) return;

    var atteso = T('ELIMINA');
    var scritto = global.prompt(T('Per confermare, scrivi {parola} in maiuscolo.', { parola: atteso }));
    if (!scritto || scritto.trim().toUpperCase() !== atteso.toUpperCase()) { toast('Cancellazione annullata.'); return; }

    toast('Cancellazione in corso…', 8000);
    global.Cloud.eliminaTutto().then(function (esito) {
      ctx.chat = [];
      ctx.docLanding = false;
      try { localStorage.removeItem(CHIAVE_ACCESSO); } catch (e) { /* ignorato */ }
      if (esito.account) {
        toast('Account e dati eliminati.', 5000);
      } else if (esito.righe) {
        // Distinzione che serve davvero: i dati non ci sono più, ma il
        // profilo di accesso sì, e va detto invece di lasciarlo credere.
        toast(T('Dati eliminati. L\'account di accesso non è stato chiuso: scrivi a {contatto} per chiuderlo.', { contatto: Legale.contatto }), 9000);
      } else {
        toast(T('Cancellazione non riuscita: {errore}', { errore: esito.errore || '' }), 9000);
      }
      renderGate();
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

      /* --- informativa e nota sull'IA --- */
      case 'doc':
        ctx.doc = el.dataset.doc === 'ia' ? 'ia' : 'privacy';
        if (document.getElementById('app').classList.contains('hidden')) {
          ctx.docLanding = true;
          renderGate();
          global.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          go('privacy');
        }
        break;

      case 'chiudi-doc':
        ctx.docLanding = false;
        renderGate();
        break;

      /* --- consensi ---
         Darlo è un clic, toglierlo è lo stesso clic: è quello che l'art. 7
         intende con "revocabile con la stessa facilità". */
      case 'consenti':
        Store.impostaConsenso(el.dataset.consenso, true);
        toast('Consenso registrato.');
        render();
        break;

      case 'revoca-ia':
        Store.impostaConsenso('ia', false);
        ctx.chat = [];
        toast('Consenso revocato: la conversazione è stata svuotata.');
        render();
        break;

      case 'elimina-account':
        eliminaAccount();
        break;

      case 'new-shift':
        openShiftForm({ date: el.dataset.date || Calc.today() });
        break;

      /* --- timbratura --- */
      case 'punch-in':
        Store.startPunch();
        toast(T('Entrata registrata alle {ora}.', { ora: Calc.timeFromMs(Date.now()) }));
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
          toast(T('Uscita registrata: {durata} ({inizio}–{fine}).', { durata: Calc.fmtDuration(min), inizio: turno.start, fine: turno.end }), 4000);
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
          toast(T('Posizione salvata (precisione {p}).', { p: Geo.fmtDist(pos.acc) }), 3500);
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
          var dove = { d: Geo.fmtDist(d), r: c.raggio };
          toast(d <= c.raggio
            ? T('Sei a {d} dal punto salvato (raggio {r} m): dentro.', dove)
            : T('Sei a {d} dal punto salvato (raggio {r} m): fuori.', dove), 5000);
        }).catch(function (err) {
          toast(err.message, 4500);
        });
        break;

      case 'edit-shift':
        openShiftForm(Store.getShift(el.dataset.id));
        break;

      case 'del-shift': {
        var s = Store.getShift(el.dataset.id);
        if (s && global.confirm(T('Eliminare il turno del {data}?', { data: Calc.fmtDate(s.date, 'medium') }))) {
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

      /* --- amministrazione --- */
      case 'admin-ricarica':
        caricaUtentiAdmin();
        break;

      case 'admin-apri':
        ctx.adminDati = null;
        render();
        Admin.dati(el.dataset.utente).then(function (d) {
          ctx.adminDati = d;
          render();
        }).catch(erroreAdmin);
        break;

      case 'admin-chiudi':
        ctx.adminDati = null;
        render();
        break;

      case 'admin-salva-turno': {
        var tr = el.closest('tr');
        var turno = { id: tr.dataset.riga, user_id: ctx.adminDati.userId };
        tr.querySelectorAll('[data-campo]').forEach(function (c) {
          turno[c.dataset.campo] = c.dataset.campo === 'break_min' ? (parseInt(c.value, 10) || 0) : c.value;
        });
        Admin.salva('shifts', turno)
          .then(function () { toast('Turno aggiornato.'); return ricaricaDatiAdmin(); })
          .catch(erroreAdmin);
        break;
      }

      case 'admin-elimina-turno': {
        var tr2 = el.closest('tr');
        if (!global.confirm(T('Eliminare definitivamente questo turno? Non è una cancellazione sincronizzabile: la riga sparisce dal server.'))) break;
        Admin.elimina('shifts', tr2.dataset.riga)
          .then(function () { toast('Turno eliminato.'); return ricaricaDatiAdmin(); })
          .catch(erroreAdmin);
        break;
      }

      case 'admin-nuovo-turno':
        Admin.salva('shifts', {
          id: 'adm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          user_id: ctx.adminDati.userId,
          date: Calc.today(), start_time: '09:00', end_time: '18:00', break_min: 60, tipo: 'lavoro', note: ''
        }).then(function () { toast('Turno salvato.'); return ricaricaDatiAdmin(); }).catch(erroreAdmin);
        break;

      case 'admin-elimina-checkin':
        if (!global.confirm(T('Eliminare definitivamente questo check-in?'))) break;
        Admin.elimina('checkins', el.dataset.id)
          .then(function () { toast('Check-in eliminato.'); return ricaricaDatiAdmin(); })
          .catch(erroreAdmin);
        break;

      case 'admin-salva-settings': {
        var dati = leggiJson('admin-settings');
        if (dati === undefined) break;
        Admin.salva('settings', { user_id: ctx.adminDati.userId, data: dati })
          .then(function () { toast('Impostazione aggiornata.'); return ricaricaDatiAdmin(); })
          .catch(erroreAdmin);
        break;
      }

      case 'admin-salva-punch': {
        var p2 = leggiJson('admin-punch');
        if (p2 === undefined) break;
        Admin.salva('punches', { user_id: ctx.adminDati.userId, punch: p2 })
          .then(function () { toast('Timbratura aggiornata.'); return ricaricaDatiAdmin(); })
          .catch(erroreAdmin);
        break;
      }

      case 'admin-azzera-punch':
        if (!global.confirm(T('Azzerare la timbratura in corso di questo utente?'))) break;
        Admin.salva('punches', { user_id: ctx.adminDati.userId, punch: null })
          .then(function () { toast('Timbratura annullata.'); return ricaricaDatiAdmin(); })
          .catch(erroreAdmin);
        break;

      /* --- landing --- */
      case 'theme-toggle':
        cambiaTema();
        break;

      case 'entra':
        apriAccesso();
        break;

      case 'registrati':
        apriAccesso(true);
        break;

      case 'entra-offline':
        ctx.offlineForzato = true;
        renderGate();
        break;

      /* --- account e sincronizzazione --- */
      case 'cloud-login':
        apriAccesso();
        break;

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
        if (global.confirm(T('Uscire dall\'account? I dati restano sul server e li ritrovi al prossimo accesso; da questo dispositivo verranno rimossi.'))) {
          global.Cloud.esci().then(function () {
            // Uscire è una scelta esplicita: si torna alla presentazione, e la
            // scorciatoia "continua senza connessione" non deve scavalcarla.
            ctx.offlineForzato = false;
            try { localStorage.removeItem(CHIAVE_ACCESSO); } catch (e) { /* ignorato */ }
            toast(T('Uscito dall\'account.'));
            renderGate();
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
        download('work-balance-backup-' + Calc.today() + '.json', Store.exportJSON(), 'application/json');
        toast('Backup esportato.');
        break;

      case 'export-csv':
        download('work-balance-turni-' + Calc.today() + '.csv', Store.exportCSV(), 'text/csv');
        toast('CSV esportato.');
        break;

      case 'import':
        document.getElementById('import-file').click();
        break;

      case 'wipe': {
        var suServer = !!(global.Cloud && global.Cloud.connesso());
        if (!global.confirm(suServer
          ? T('Cancellare tutti i turni e i check-in, qui e sul server? L\'operazione non è reversibile.')
          : T('Cancellare tutti i turni e i check-in salvati? L\'operazione non è reversibile.'))) break;
        // Uno a uno, non in blocco: solo così restano le lapidi che dicono al
        // server di cancellare anche lì. Un azzeramento locale e basta
        // tornerebbe indietro alla prima sincronizzazione.
        Store.shifts().slice().forEach(function (t) { Store.deleteShift(t.id); });
        Store.checkins().slice().forEach(function (c) { Store.deleteCheckin(c.id); });
        if (suServer) global.Cloud.sincronizza(true);
        toast(suServer ? 'Dati cancellati, qui e sul server.' : 'Dati cancellati.');
        render();
        break;
      }
    }
  }

  function onChange(e) {
    var el = e.target;

    if (el.dataset && el.dataset.consenso) {
      Store.impostaConsenso(el.dataset.consenso, el.checked);
      if (el.dataset.consenso === 'ia' && !el.checked) ctx.chat = [];
      toast(el.checked ? 'Consenso registrato.' : 'Consenso revocato.');
      render();
      return;
    }

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
          toast(T('Importati: {n} turni in archivio.', { n: n }));
          render();
        } catch (err) {
          toast(T('File non valido: {motivo}', { motivo: err.message }), 4000);
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
    if (pctEl) { pctEl.textContent = Calc.fmtPct(pct) + ' di ' + Calc.fmtDuration(target); I18n.traduciDOM(pctEl); }
    var det = document.getElementById('punch-detail');
    if (det) { det.innerHTML = UI.punchDetail(p, t, Calc.expectedEnd(p, st, Math.max(0, target - giorno.worked))); I18n.traduciDOM(det); }
  }

  /* ---------------- amministrazione ---------------- */

  function erroreAdmin(err) {
    ctx.adminErrore = String(err && err.message || err);
    render();
  }

  function leggiJson(id) {
    var el = document.getElementById(id);
    if (!el) return undefined;
    var testo = el.value.trim();
    if (!testo) return null;
    try {
      return JSON.parse(testo);
    } catch (e) {
      // Salvare un JSON malformato sostituirebbe dati validi con niente.
      toast(T('JSON non valido: {motivo}', { motivo: e.message }), 4500);
      return undefined;
    }
  }

  function caricaUtentiAdmin() {
    ctx.adminUtenti = null;
    ctx.adminErrore = null;
    render();
    return Admin.utenti().then(function (u) {
      ctx.adminUtenti = u;
      render();
    }).catch(erroreAdmin);
  }

  function ricaricaDatiAdmin() {
    if (!ctx.adminDati) return Promise.resolve();
    return Admin.dati(ctx.adminDati.userId).then(function (d) {
      ctx.adminDati = d;
      render();
    }).catch(erroreAdmin);
  }

  /* La scheda compare solo se il server conferma. Il controllo che conta è
     nelle policy del database: qui si evita di mostrare una scheda che
     risponderebbe vuota. */
  function aggiornaSchedaAdmin() {
    var tab = document.getElementById('tab-admin');
    if (!tab) return;
    if (!global.Cloud || !global.Cloud.connesso()) {
      tab.classList.add('hidden');
      if (ctx.view === 'admin') go('dashboard');
      return;
    }
    Admin.verifica().then(function (ok) {
      tab.classList.toggle('hidden', !ok);
      if (!ok && ctx.view === 'admin') go('dashboard');
      else if (ok && ctx.view === 'admin' && !ctx.adminUtenti) caricaUtentiAdmin();
    });
  }

  /* ---------------- accesso ---------------- */

  /* Se le librerie non sono mai arrivate, il primo clic è un nuovo tentativo:
     aprire la finestra senza Clerk caricato darebbe un riquadro vuoto, che è
     il modo peggiore di dire "non ha funzionato". */
  function apriAccesso(registrazione) {
    var apri = function () {
      if (registrazione) global.Cloud.apriRegistrazione();
      else global.Cloud.apriAccesso();
    };
    if (global.Cloud.stato().disponibile) { apri(); return; }
    renderGate();
    global.Cloud.riprova().then(function (st) {
      renderGate();
      if (st.disponibile) apri();
      else toast(T('Servizio di accesso non raggiungibile. Controlla la connessione e riprova.'));
    });
  }

  /* ---------------- lingua e tema ---------------- */

  function cambiaTema() {
    var next = Store.settings().tema === 'light' ? 'dark' : 'light';
    Store.updateSettings({ tema: next });
    applyTheme(next);
    renderGate();
  }

  function riempiSelettoreLingua() {
    var sel = document.getElementById('sel-lingua');
    if (!sel) return;
    sel.innerHTML = I18n.lingue.map(function (l) {
      return '<option value="' + l.code + '"' + (l.code === I18n.lingua() ? ' selected' : '') + '>' +
        l.bandiera + '  ' + l.nome + '</option>';
    }).join('');
    sel.setAttribute('aria-label', T('Lingua'));
  }

  /* Le poche stringhe scritte direttamente in index.html: nomi delle schede,
     titoli dei pulsanti, testo del piè di pagina. */
  function traduciMarcatura() {
    var etichette = {
      dashboard: T('Oggi'),
      turni: T('Turni'),
      statistiche: T('Statistiche'),
      benessere: T('Benessere'),
      impostazioni: T('Impostazioni'),
      admin: T('Amministrazione')
    };
    document.querySelectorAll('.tab').forEach(function (t) {
      var testo = etichette[t.dataset.view];
      if (!testo) return;
      var span = t.querySelector('span');
      if (span) span.textContent = testo;
      t.setAttribute('aria-label', testo);
    });

    var titoli = [
      ['btn-theme', T('Cambia tema')],
      ['btn-install', T('Installa l\'app')]
    ];
    titoli.forEach(function (v) {
      var el = document.getElementById(v[0]);
      if (!el) return;
      el.title = v[1];
      el.setAttribute('aria-label', v[1]);
    });

    var foot = document.querySelector('.foot span');
    if (foot) foot.textContent = T('I dati restano sul tuo dispositivo.');

    document.title = T('Work Balance — Turni, ore e benessere');
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

    document.getElementById('btn-theme').addEventListener('click', cambiaTema);

    // Il selettore della barra e quello della landing sono due elementi
    // distinti perché le due schermate sono separate: la logica è una sola.
    document.addEventListener('change', function (e) {
      if (!e.target || e.target.id !== 'sel-lingua' && e.target.id !== 'sel-lingua-landing') return;
      I18n.imposta(e.target.value);
    });
    I18n.onChange(function (lingua) {
      riempiSelettoreLingua();
      traduciMarcatura();
      renderGate();
      // Anche la finestra di accesso di Clerk deve parlare la lingua scelta.
      if (global.Cloud && global.Cloud.cambiaLingua) {
        global.Cloud.cambiaLingua(lingua).then(renderGate);
      }
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

    // Il dizionario della lingua scelta arriva da un file a parte: disegnare
    // prima mostrerebbe l'italiano per un istante a chi ha scelto altro.
    I18n.precarica().then(function () {
      riempiSelettoreLingua();
      traduciMarcatura();
      renderGate();
    });

    setInterval(tickPunch, 1000);
    Geo.sync();

    // Il modulo cloud si carica dopo (è un modulo ES): quando cambia stato,
    // la vista si aggiorna da sola. È anche il momento in cui si scopre se
    // l'utente ha una sessione valida, cioè se mostrare l'app o la landing.
    var attesaCloud = setInterval(function () {
      if (!global.Cloud) return;
      clearInterval(attesaCloud);
      global.Cloud.onChange(function () {
        if (global.Cloud.connesso()) segnaAccesso();
        renderGate();
        aggiornaSchedaAdmin();
      });
      renderGate();
      aggiornaSchedaAdmin();
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

      // Chiedo al service worker quale versione sta servendo, così la scheda
      // "App" può dirlo senza aprire gli strumenti da sviluppatore.
      navigator.serviceWorker.addEventListener('message', function (e) {
        if (e.data && e.data.tipo === 'versione') {
          ctx.swVersione = e.data.cache;
          render();
        }
      });
      var chiediVersione = function () {
        if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('versione');
      };
      chiediVersione();
      // "ready" garantisce un service worker attivo, ma non che controlli già
      // questa pagina: alla prima visita il controllo arriva dopo, con
      // clients.claim(), e senza richiederla di nuovo la scheda App direbbe
      // "nessun service worker attivo" mentre invece ce n'è uno.
      navigator.serviceWorker.ready.then(chiediVersione);

      var avevaControllo = !!navigator.serviceWorker.controller;
      var giaRicaricato = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        chiediVersione();
        // Quando una versione nuova prende il controllo, la pagina sta ancora
        // usando i file vecchi: la ricarico una volta sola, così l'aggiornamento
        // si vede subito invece che alla visita successiva. Solo se un service
        // worker c'era già: alla primissima visita "controllerchange" segnala
        // l'installazione, e i file in pagina sono comunque quelli giusti.
        if (!avevaControllo || giaRicaricato) return;
        giaRicaricato = true;
        location.reload();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.App = { ctx: ctx, render: render, renderGate: renderGate, go: go, toast: toast, aiSend: aiSend };
})(window);
