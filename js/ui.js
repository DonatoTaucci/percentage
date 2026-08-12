/* ui.js — rendering delle viste. Ogni funzione restituisce HTML;
   gli eventi sono gestiti in app.js tramite delega. */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* =========================================================
     LANDING — solo sito. L'app per telefono parte dall'accesso.
     ========================================================= */

  function selettoreLingua(id) {
    var attuale = I18n.lingua();
    var opzioni = I18n.lingue.map(function (l) {
      return '<option value="' + l.code + '"' + (l.code === attuale ? ' selected' : '') + '>' +
        l.bandiera + '  ' + esc(l.nome) + '</option>';
    }).join('');
    return '<select id="' + id + '" class="sel-lingua" aria-label="' + esc(T('Lingua')) + '">' + opzioni + '</select>';
  }

  function landingCard(icona, titolo, testo) {
    return '<div class="landing-card">' +
      '<div class="landing-ico">' + icona + '</div>' +
      '<h3>' + esc(titolo) + '</h3>' +
      '<p>' + esc(testo) + '</p>' +
      '</div>';
  }

  function passo(titolo, testo) {
    return '<div class="passo"><h4>' + esc(titolo) + '</h4><p>' + esc(testo) + '</p></div>';
  }

  function landing(stato) {
    stato = stato || {};
    var ICO = {
      timbro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
      grafico: '<svg viewBox="0 0 24 24"><path d="M4 20V13M9.3 20V6M14.7 20v-9M20 20V9"/></svg>',
      gps: '<svg viewBox="0 0 24 24"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
      cuore: '<svg viewBox="0 0 24 24"><path d="M20.3 6.7a4.6 4.6 0 0 0-6.6 0L12 8.4l-1.7-1.7a4.6 4.6 0 1 0-6.6 6.5l8.3 8.3 8.3-8.3a4.6 4.6 0 0 0 0-6.5Z"/></svg>'
    };

    var html = '<div class="landing">';

    /* intestazione */
    html += '<div class="landing-top">';
    html += '<div class="brand"><span class="brand-mark">%</span><div>' +
      '<h1>Work Balance</h1><p>' + esc(T('Turni, ore e benessere')) + '</p></div></div>';
    html += '<div class="row" style="gap:8px">' + selettoreLingua('sel-lingua-landing') +
      '<button class="icon-btn" type="button" data-action="theme-toggle" title="' + esc(T('Cambia tema')) + '" aria-label="' + esc(T('Cambia tema')) + '">◐</button>' +
      '</div>';
    html += '</div>';

    /* hero */
    html += '<div class="hero">';
    html += '<h2>' + esc(T('Quanto stai lavorando davvero?')) + '</h2>';
    html += '<p class="lead">' + esc(T('Timbri entrata e uscita, e Work Balance calcola quanto hai lavorato rispetto al tuo orario: ogni giorno, ogni settimana, ogni mese. Straordinari compresi. E ti aiuta ad accorgerti per tempo se stai esagerando.')) + '</p>';

    html += '<div class="hero-cta">';
    if (stato.errore) {
      html += '<button class="btn primary" data-action="entra">' + esc(T('Riprova ad accedere')) + '</button>';
    } else {
      // Due percorsi dichiarati. La finestra di Clerk crea l'account da sola
      // quando l'indirizzo non esiste, ma non lo dice: chi arriva la prima
      // volta vedrebbe solo "Entra" e non saprebbe da dove iscriversi.
      html += '<button class="btn primary" data-action="entra"' + (stato.pronto ? '' : ' disabled') + '>' +
        esc(stato.pronto ? T('Entra') : T('Caricamento…')) + '</button>';
      if (stato.pronto) {
        html += '<button class="btn" data-action="registrati">' + esc(T('Registrati')) + '</button>';
      }
    }
    if (stato.giaAccesso) {
      html += '<button class="btn" data-action="entra-offline">' + esc(T('Continua senza connessione')) + '</button>';
    }
    html += '</div>';

    if (stato.errore) {
      html += '<div class="note" style="max-width:56ch;margin:18px auto 0">' + esc(stato.errore) + '</div>';
    }
    html += '<p class="hero-nota">' + esc(T('Serve un account: è quello che fa ritrovare gli stessi turni sul computer e sul telefono.')) + '</p>';
    html += '</div>';

    /* cosa fa */
    html += '<div class="landing-grid">';
    html += landingCard(ICO.timbro, T('Come un badge'),
      T('Premi un tasto quando entri e uno quando esci, pausa pranzo compresa. Niente moduli da riempire a fine giornata: il turno si scrive da solo.'));
    html += landingCard(ICO.grafico, T('La percentuale che conta'),
      T('Imposti il tuo orario una volta, e vedi subito a che punto sei rispetto al dovuto. Su un mese ancora in corso il confronto è con i giorni già passati, non con il mese intero.'));
    html += landingCard(ICO.gps, T('Timbratura automatica'),
      T('Sull\'app per telefono puoi indicare dove lavori: entrando e uscendo dalla zona la timbratura parte da sola, anche ad app chiusa, e riconosce l\'uscita per la pausa.'));
    html += landingCard(ICO.cuore, T('Prima che diventi troppo'),
      T('Un questionario sul carico di lavoro, unito alle ore che hai davvero fatto, restituisce un indice di rischio e consigli concreti su cosa cambiare.'));
    html += '</div>';

    /* come funziona */
    html += '<div class="landing-sez">';
    html += '<h3>' + esc(T('Come si comincia')) + '</h3>';
    html += '<p class="sub">' + esc(T('Tre minuti, una volta sola.')) + '</p>';
    html += '<div class="passi">';
    html += passo(T('Accedi'), T('Con Google, Apple, Facebook o semplicemente la tua email: ricevi un codice, senza password da ricordare.'));
    html += passo(T('Imposta il tuo orario'), T('Ora di inizio, pausa pranzo e ora di fine. Da qui l\'app ricava le ore che ti spettano e riconosce gli straordinari.'));
    html += passo(T('Timbra'), T('Dal computer o dal telefono, indifferentemente: i dati sono gli stessi e si allineano da soli.'));
    html += '</div></div>';

    /* dispositivi */
    html += '<div class="landing-sez">';
    html += '<h3>' + esc(T('Sul computer e sul telefono')) + '</h3>';
    html += '<p class="sub">' + esc(T('Lo stesso account, gli stessi turni.')) + '</p>';
    html += '<div class="landing-grid" style="margin-top:0">';
    html += landingCard(ICO.grafico, T('Dal browser'),
      T('Questo sito funziona su qualunque computer e si può installare come applicazione. Una volta installato funziona anche senza connessione.'));
    html += landingCard(ICO.gps, T('App per Android e iPhone'),
      T('L\'applicazione nativa aggiunge la timbratura automatica con il GPS e le notifiche: cose che un sito, per come sono fatti i browser, non può fare a app chiusa.'));
    html += '</div></div>';

    // L'informativa dev'essere leggibile prima di creare l'account, non dopo:
    // è il momento in cui si decide se dare i propri dati.
    html += '<div class="landing-foot">';
    html += '<p style="margin:0 0 10px">' + esc(T('I turni restano sul tuo dispositivo e sul tuo account. Nient\'altro.')) + '</p>';
    html += '<div class="row" style="justify-content:center;gap:14px">' +
      '<button class="btn sm ghost" data-action="doc" data-doc="privacy">' + esc(T('Informativa privacy')) + '</button>' +
      '<button class="btn sm ghost" data-action="doc" data-doc="ia">' + esc(T('Intelligenza artificiale')) + '</button>' +
      '</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  /* Contenitore del componente di accesso di Clerk.

     Il riquadro di Clerk ha misure proprie e va soltanto centrato: qualsiasi
     tentativo di vestirlo si trasformerebbe in una rincorsa a ogni loro
     rilascio. Qui intorno ci mettiamo solo ciò che è nostro — il marchio, la
     lingua, la via d'uscita — e il link all'informativa, perché la decisione
     di creare un account si prende sapendo che fine fanno i propri dati. */
  function pannelloAccesso(stato) {
    var html = '<div class="landing"><div class="landing-top">';
    html += '<div class="brand"><span class="brand-mark">%</span><div>' +
      '<h1>Work Balance</h1><p>' + esc(T('Turni, ore e benessere')) + '</p></div></div>';
    html += '<div class="row" style="gap:8px">' + selettoreLingua('sel-lingua-accesso') + '</div>';
    html += '</div>';

    html += '<div class="row" style="gap:8px;margin-bottom:18px">' +
      '<button class="btn sm ghost" data-action="chiudi-accesso">' + esc(T('Torna indietro')) + '</button>' +
      '<button class="btn sm ghost" data-action="doc" data-doc="privacy">' + esc(T('Informativa privacy')) + '</button>' +
      '</div>';

    html += '<div class="accesso"><div id="clerk-accesso"></div>';
    if (!stato || !stato.pronto) {
      html += '<p class="small muted" style="text-align:center">' + esc(T('Caricamento…')) + '</p>';
    }
    html += '</div></div>';
    return html;
  }

  /* I due documenti, con la stessa impaginazione dentro e fuori dall'app. */
  function documenti(ctx, daLanding) {
    var quale = (ctx && ctx.doc) === 'ia' ? 'ia' : 'privacy';
    var html = '';

    if (daLanding) {
      html += '<div class="landing"><div class="landing-top">';
      html += '<div class="brand"><span class="brand-mark">%</span><div>' +
        '<h1>Work Balance</h1><p>' + esc(T('Turni, ore e benessere')) + '</p></div></div>';
      html += '<div class="row" style="gap:8px">' + selettoreLingua('sel-lingua-landing') + '</div>';
      html += '</div>';
    }

    html += '<div class="doc-nav">';
    html += '<button class="btn sm ghost" data-action="' + (daLanding ? 'chiudi-doc' : 'goto') + '"' +
      (daLanding ? '' : ' data-view="impostazioni"') + '>' + esc(T('Torna indietro')) + '</button>';
    html += '<button class="btn sm' + (quale === 'privacy' ? ' primary' : '') + '" data-action="doc" data-doc="privacy">' +
      esc(T('Informativa privacy')) + '</button>';
    html += '<button class="btn sm' + (quale === 'ia' ? ' primary' : '') + '" data-action="doc" data-doc="ia">' +
      esc(T('Intelligenza artificiale')) + '</button>';
    html += '</div>';

    html += quale === 'ia' ? Legale.notaIA() : Legale.informativa();

    if (daLanding) html += '</div>';
    return html;
  }

  function maiuscola(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  /* Date nella lingua scelta: il formato lo decide il sistema, non noi. */
  function dataLocale(ts) { return new Date(ts).toLocaleDateString(I18n.lingua()); }

  function saldoBadge(minutes) {
    if (Math.abs(minutes) < 1) return '<span class="badge">In pari</span>';
    if (minutes > 0) return '<span class="badge warn">+' + Calc.fmtDuration(minutes) + '</span>';
    return '<span class="badge bad">−' + Calc.fmtDuration(Math.abs(minutes)) + '</span>';
  }

  function stat(label, value, sub, cls) {
    return '<div class="stat">' +
      '<span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-value ' + (cls || '') + '">' + value + '</span>' +
      (sub ? '<span class="stat-sub">' + sub + '</span>' : '') +
      '</div>';
  }

  function tipoBadge(tipo) {
    var def = Calc.TIPI[tipo] || Calc.TIPI.lavoro;
    var cls = tipo === 'lavoro' ? 'info' : (tipo === 'malattia' ? 'bad' : '');
    return '<span class="badge ' + cls + '">' + esc(def.label) + '</span>';
  }

  /* =========================================================
     OGGI
     ========================================================= */
  function dashboard() {
    var st = Store.settings();
    var shifts = Store.shifts();
    var oggi = Calc.today();

    var day = Calc.daySummary(oggi, shifts, st);
    var wStart = Calc.weekStart(oggi, st.inizioSettimana);
    var wEnd = Calc.weekEnd(oggi, st.inizioSettimana);
    var week = Calc.rangeSummary(wStart, wEnd, shifts, st);
    var month = Calc.rangeSummary(Calc.monthStart(oggi), Calc.monthEnd(oggi), shifts, st, {
      targetOverrideMinutes: st.oreMensiliFisse > 0 ? Math.round(st.oreMensiliFisse * 60) : 0
    });

    // Le ore della timbratura aperta entrano subito nei totali di settimana e mese.
    var punch = Store.punch();
    var tp = punch ? Calc.punchTotals(punch) : null;
    week = conTimbratura(week, punch, tp);
    month = conTimbratura(month, punch, tp);

    var html = '';

    /* --- oggi: timbratura --- */
    html += punchCard(day, st, oggi);

    /* --- settimana --- */
    var giorniW = week.days.map(function (d) {
      var live = (punch && punch.date === d.date) ? tp.lavoro : 0;
      return {
        label: Calc.GIORNI_BREVI[Calc.dow(d.date)].charAt(0).toUpperCase(),
        value: (d.worked + live) / 60,
        target: d.target / 60,
        highlight: d.date === oggi,
        color: d.date === oggi ? 'var(--accent)' : (d.worked > d.target && d.target > 0 ? 'var(--violet)' : 'var(--accent-soft)'),
        title: Calc.fmtDate(d.date, 'medium') + ': ' + Calc.fmtDuration(d.worked)
      };
    });

    html += '<div class="grid grid-2" style="margin-top:14px">';

    html += '<div class="card">';
    html += '<div class="row-between"><div class="card-title">Settimana ' + Calc.isoWeekNumber(oggi) + '</div>' +
            '<span class="tiny muted">' + esc(Calc.fmtDate(wStart)) + ' – ' + esc(Calc.fmtDate(wEnd)) + '</span></div>';
    html += periodDonut(week);
    html += '<div style="margin-top:14px">' + Charts.bars(giorniW, { height: 150 }) + '</div>';
    html += '</div>';

    /* --- mese --- */
    html += '<div class="card">';
    html += '<div class="row-between"><div class="card-title">' + esc(Calc.fmtMonth(oggi)) + '</div>' +
            '<span class="tiny muted">' + month.workedDays + ' giorni lavorati</span></div>';
    html += periodDonut(month);

    var settimaneMese = weeksOfMonth(oggi, shifts, st);
    html += '<div style="margin-top:14px">' + Charts.bars(settimaneMese.map(function (w, i) {
      return {
        label: 'S' + (i + 1),
        value: w.worked / 60,
        target: w.target / 60,
        color: 'var(--accent-soft)',
        title: 'Settimana ' + (i + 1) + ': ' + Calc.fmtDuration(w.worked) + ' (' + Calc.fmtPct(w.pct) + ')'
      };
    }), { height: 150 }) + '</div>';
    html += '</div>';

    html += '</div>'; // grid

    /* --- benessere --- */
    html += wellnessTeaser();

    return html;
  }

  /* ---------- timbratura ---------- */

  function orarioStandardTesto(st) {
    var o = st.orario || {};
    var t = esc(o.inizio || '—') + ' – ' + esc(o.fine || '—');
    if (o.pausaInizio && o.pausaFine) t += ' · pausa ' + esc(o.pausaInizio) + '–' + esc(o.pausaFine);
    return t;
  }

  function punchCard(day, st, oggi) {
    var p = Store.punch();
    var html = '<div class="card pad-lg">';

    html += '<div class="row-between" style="margin-bottom:14px">';
    html += '<div><div class="card-title" style="margin:0">Oggi</div><strong>' + esc(Calc.fmtDate(oggi, 'long')) + '</strong></div>';
    html += '<span class="tiny muted">Standard ' + orarioStandardTesto(st) + '</span>';
    html += '</div>';

    if (p) {
      /* --- timbratura in corso --- */
      var t = Calc.punchTotals(p);
      var giornoP = Calc.daySummary(p.date, Store.shifts(), st);
      var target = giornoP.target > 0 ? giornoP.target : Math.round(st.oreGiornaliere * 60);
      var lavoroTot = giornoP.worked + t.lavoro;
      var pct = target > 0 ? (lavoroTot / target) * 100 : 0;
      var uscita = Calc.expectedEnd(p, st, Math.max(0, target - giornoP.worked));

      if (t.giorniFa >= 1) {
        html += '<div class="note" style="margin-bottom:14px;border-color:var(--warn)"><strong>Timbratura aperta dal ' +
          esc(Calc.fmtDate(p.date, 'medium')) + '.</strong> Se hai dimenticato di uscire, timbra l\'uscita e correggi l\'orario dal turno salvato.</div>';
      }

      html += '<div class="punch-live">';
      html += '<div class="punch-clock-wrap">';
      html += '<span class="badge ' + (t.inPausa ? 'warn' : 'ok') + '" id="punch-state">' +
        '<span class="dot-live"></span>' + (t.inPausa ? 'In pausa' : 'In turno') + '</span>';
      html += '<div class="punch-clock" id="punch-clock">' + fmtClock(t.lavoroSec) + '</div>';
      html += '<div class="tiny muted" id="punch-detail">' + punchDetail(p, t, uscita) + '</div>';
      html += '</div>';

      html += '<div class="punch-side">';
      html += '<div class="row-between tiny muted" style="margin-bottom:6px">' +
        '<span id="punch-pct">' + Calc.fmtPct(pct) + ' di ' + Calc.fmtDuration(target) + '</span>' +
        (lavoroTot > target && target > 0 ? '<span class="badge warn">Straord. ' + Calc.fmtDuration(lavoroTot - target) + '</span>' : '') +
        '</div>';
      // Durante il turno la barra resta neutra: una percentuale bassa a metà
      // mattina non è un problema da segnalare in rosso.
      html += '<div id="punch-meter">' + Charts.meter(pct, 'var(--accent)') + '</div>';
      html += '<div class="row" style="margin-top:14px;gap:8px">';
      html += '<button class="btn' + (t.inPausa ? ' primary' : '') + '" data-action="punch-break">' +
        (t.inPausa ? 'Riprendi' : 'Vai in pausa') + '</button>';
      html += '<button class="btn' + (t.inPausa ? '' : ' primary') + '" data-action="punch-out">Timbra uscita</button>';
      html += '</div>';
      html += '<button class="btn sm ghost" style="margin-top:8px" data-action="punch-cancel">Annulla timbratura</button>';
      html += '</div>';
      html += '</div>';

    } else {
      /* --- nessuna timbratura --- */
      html += '<div class="pct-hero">';
      html += Charts.donut(day.pct, {
        size: 128,
        label: Calc.fmtPct(day.pct),
        sub: day.target > 0 ? 'del previsto' : 'giorno non lavorativo'
      });
      html += '<div class="pct-hero-info">';
      html += '<div class="grid grid-3" style="gap:12px">';
      html += stat('Lavorate', Calc.fmtDuration(day.worked), day.pausa ? 'pausa ' + Calc.fmtDuration(day.pausa) : '', 'sm');
      html += stat('Previste', day.target > 0 ? Calc.fmtDuration(day.target) : '—', '', 'sm');
      html += stat('Straordinario', day.overtime > 0 ? '+' + Calc.fmtDuration(day.overtime) : '—', '', 'sm');
      html += '</div>';
      html += '<button class="btn primary block" style="margin-top:14px;min-height:52px;font-size:16px" data-action="punch-in">Timbra entrata</button>';
      html += '<div class="row" style="margin-top:8px;gap:8px">';
      html += '<button class="btn sm ghost" data-action="new-shift" data-date="' + oggi + '">Inserimento manuale</button>';
      if (!day.entries.length) {
        html += '<button class="btn sm ghost" data-action="quick-standard">Giornata standard</button>';
      }
      html += '</div>';
      html += '<p class="tiny muted" style="margin:8px 0 0">Con l\'inserimento manuale puoi registrare anche solo l\'entrata o solo l\'uscita, e completare il turno più avanti.</p>';
      html += '</div></div>';
    }

    /* turni già registrati oggi */
    if (day.entries.length) {
      html += '<div style="margin-top:16px">' + day.entries.map(shiftRow).join('') + '</div>';
    } else if (!p) {
      html += '<p class="muted small" style="margin:16px 0 0">Nessun turno registrato per oggi.</p>';
    }

    html += Geo.statusHTML();
    html += '</div>';
    return html;
  }

  function fmtClock(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h + ':' + Calc.pad(m) + ':' + Calc.pad(s);
  }

  function punchDetail(p, t, uscitaMs) {
    var parts = ['Entrata ' + Calc.timeFromMs(p.startedAt)];
    if (t.pausa > 0) parts.push('pausa ' + Calc.fmtDuration(t.pausa));
    if (t.inPausa) parts.push('in pausa da ' + Calc.timeFromMs(t.pausaCorrenteDa));
    else if (uscitaMs) parts.push('uscita prevista ' + Calc.timeFromMs(uscitaMs));
    return esc(parts.join(' · '));
  }

  /* Somma a un riepilogo le ore della timbratura ancora aperta. */
  function conTimbratura(sum, punch, t) {
    if (!punch || !t || punch.date < sum.from || punch.date > sum.to) return sum;
    var s = Object.assign({}, sum);
    s.worked += t.lavoro;
    s.credited += t.lavoro;
    s.creditedToDate += t.lavoro;
    s.pct = s.target > 0 ? (s.credited / s.target) * 100 : 0;
    s.pctToDate = s.targetToDate > 0 ? (s.creditedToDate / s.targetToDate) * 100 : 0;
    s.saldo = s.credited - s.target;
    s.saldoToDate = s.creditedToDate - s.targetToDate;
    s.live = true;
    return s;
  }

  /* Anello + numeri di un periodo. Se il periodo è ancora in corso la
     percentuale principale è quella sul previsto maturato a oggi. */
  function periodDonut(sum) {
    var inCorso = sum.inCorso && sum.targetToDate < sum.target;
    var pct = inCorso ? sum.pctToDate : sum.pct;
    var saldo = inCorso ? sum.saldoToDate : sum.saldo;

    var html = '<div class="row" style="gap:16px;align-items:center">';
    html += Charts.donut(pct, { size: 96, stroke: 11, sub: inCorso ? 'a oggi' : '' });
    html += '<div class="stack" style="flex:1;min-width:140px">';
    html += stat('Lavorate', Calc.fmtDuration(sum.worked),
      'su ' + Calc.fmtDuration(inCorso ? sum.targetToDate : sum.target) + ' previste' + (inCorso ? ' finora' : ''), 'sm');
    html += '<div class="row" style="gap:8px">' + saldoBadge(saldo) +
      (sum.overtime > 0 ? '<span class="badge warn">Straord. ' + Calc.fmtDuration(sum.overtime) + '</span>' : '') + '</div>';
    if (inCorso) {
      html += '<span class="tiny muted">' + Calc.fmtPct(sum.pct) + ' del periodo completo (' + Calc.fmtDuration(sum.target) + ')' +
        (sum.live ? ' · timbratura in corso inclusa' : '') + '</span>';
    }
    html += '</div></div>';
    return html;
  }

  function weeksOfMonth(anyISO, shifts, st) {
    var start = Calc.monthStart(anyISO);
    var end = Calc.monthEnd(anyISO);
    var cur = Calc.weekStart(start, st.inizioSettimana);
    var out = [];
    var guard = 0;
    while (cur <= end && guard++ < 8) {
      var wEnd = Calc.addDays(cur, 6);
      out.push(Calc.rangeSummary(
        cur < start ? start : cur,
        wEnd > end ? end : wEnd,
        shifts, st
      ));
      cur = Calc.addDays(cur, 7);
    }
    return out;
  }

  function wellnessTeaser() {
    var last = Store.lastCheckin();
    var m = Coach.workMetrics(Store.shifts(), Store.settings());
    var obj = Coach.objectiveRisk(m);

    var html = '<div class="card" style="margin-top:14px">';
    html += '<div class="card-title">Benessere</div>';

    if (last) {
      var lvl = Coach.levelFor(last.score);
      var giorni = Math.floor((Date.now() - last.ts) / 86400000);
      html += '<div class="row-between">';
      html += '<div><div class="row" style="gap:8px"><span class="badge ' + lvl.tone + '">' + esc(lvl.label) + '</span>' +
              '<span class="tiny muted">check-in di ' + (giorni === 0 ? 'oggi' : giorni + ' giorni fa') + '</span></div>' +
              '<p class="small muted" style="margin:8px 0 0;max-width:52ch">' + esc(lvl.msg) + '</p></div>';
      html += '<button class="btn sm" data-action="goto" data-view="benessere">Apri</button>';
      html += '</div>';
      if (giorni >= 21) {
        html += '<p class="tiny muted" style="margin:10px 0 0">Sono passate più di tre settimane: un nuovo check-in aggiornerebbe il quadro.</p>';
      }
    } else {
      html += '<div class="row-between">';
      html += '<p class="small muted" style="margin:0;max-width:56ch">Un check-in di 16 domande stima il rischio di burnout incrociando le tue risposte con le ore che hai registrato, e restituisce consigli concreti.</p>';
      html += '<button class="btn primary sm" data-action="goto" data-view="benessere">Inizia</button>';
      html += '</div>';
    }

    if (obj.flags.length) {
      html += '<div class="note" style="margin-top:12px"><strong>Dai tuoi turni:</strong><ul style="margin:6px 0 0;padding-left:18px">' +
        obj.flags.slice(0, 3).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    }

    html += '</div>';
    return html;
  }

  /* =========================================================
     TURNI
     ========================================================= */
  function shiftRow(s) {
    var st = Store.settings();
    var min = Calc.shiftMinutes(s, st);
    var d = Calc.fromISO(s.date);
    var isLavoro = (Calc.TIPI[s.tipo] || Calc.TIPI.lavoro).conteggia === 'ore';

    var incompleto = Calc.turnoIncompleto(s);
    var sub;
    if (isLavoro) {
      // Il lato mancante si vede: "09:00 – ?" dice più di una riga monca.
      sub = esc(s.start || '?') + ' – ' + esc(s.end || '?') +
        (s.breakMin ? ' · pausa ' + s.breakMin + 'm' : ' · nessuna pausa') +
        (Calc.isNightShift(s) ? ' · serale/notturno' : '');
    } else {
      sub = (Calc.TIPI[s.tipo] || {}).label || s.tipo;
    }
    if (s.note) sub += ' · <span data-no-i18n>' + esc(s.note) + '</span>';

    return '<div class="shift">' +
      '<div class="shift-date"><div class="d">' + d.getDate() + '</div><div class="m">' + Calc.MESI_BREVI[d.getMonth()] + '</div></div>' +
      '<div class="shift-main">' +
        '<div class="t">' + (incompleto
            ? '<span class="badge warn">' + esc(T('Da completare')) + '</span>'
            : (isLavoro ? Calc.fmtDuration(min) : tipoBadge(s.tipo))) + '</div>' +
        '<div class="s">' + sub + '</div>' +
      '</div>' +
      '<div class="shift-actions">' +
        '<button class="btn sm ghost" data-action="edit-shift" data-id="' + s.id + '" title="Modifica">✎</button>' +
        '<button class="btn sm ghost" data-action="del-shift" data-id="' + s.id + '" title="Elimina">🗑</button>' +
      '</div>' +
    '</div>';
  }

  function turni(ctx) {
    var st = Store.settings();
    var shifts = Store.shifts();
    var mese = ctx.turniMonth || Calc.today();
    var from = Calc.monthStart(mese);
    var to = Calc.monthEnd(mese);
    var sum = Calc.rangeSummary(from, to, shifts, st, {
      targetOverrideMinutes: st.oreMensiliFisse > 0 ? Math.round(st.oreMensiliFisse * 60) : 0
    });

    var html = '';

    html += '<div class="card">';
    html += '<div class="row-between">';
    html += '<div class="row" style="gap:6px">' +
      '<button class="btn sm ghost" data-action="month" data-delta="-1" aria-label="Mese precedente">‹</button>' +
      '<strong style="min-width:150px;text-align:center">' + esc(Calc.fmtMonth(mese)) + '</strong>' +
      '<button class="btn sm ghost" data-action="month" data-delta="1" aria-label="Mese successivo">›</button>' +
      '</div>';
    html += '<button class="btn primary sm" data-action="new-shift" data-date="' + Calc.today() + '">+ Nuovo turno</button>';
    html += '</div>';

    var inCorso = sum.inCorso && sum.targetToDate < sum.target;
    html += '<div class="grid grid-4" style="margin-top:16px">';
    html += stat('Percentuale',
      Calc.fmtPct(inCorso ? sum.pctToDate : sum.pct),
      inCorso
        ? Calc.fmtDuration(sum.creditedToDate) + ' / ' + Calc.fmtDuration(sum.targetToDate) + ' a oggi'
        : Calc.fmtDuration(sum.credited) + ' / ' + Calc.fmtDuration(sum.target));
    html += stat('Ore lavorate', Calc.fmtHours(sum.worked), sum.workedDays + ' giorni');
    html += stat('Straordinari', sum.overtime > 0 ? Calc.fmtHours(sum.overtime) : '0 h',
      st.pagaOraria > 0 && sum.overtime > 0 ? '≈ ' + Calc.fmtMoney(Calc.overtimePay(sum.overtime, st), st) : '');
    var saldoMese = inCorso ? sum.saldoToDate : sum.saldo;
    html += stat('Saldo', (saldoMese >= 0 ? '+' : '−') + Calc.fmtDuration(Math.abs(saldoMese)),
      saldoMese >= 0 ? 'sopra il previsto' : 'sotto il previsto');
    html += '</div>';
    html += '<div style="margin-top:14px">' + Charts.meter(inCorso ? sum.pctToDate : sum.pct) + '</div>';
    if (inCorso) {
      html += '<p class="tiny muted" style="margin:8px 0 0">Mese in corso: la percentuale è calcolata sulle ore previste fino a oggi. ' +
        'Sull\'intero mese sarebbe ' + Calc.fmtPct(sum.pct) + ' di ' + Calc.fmtDuration(sum.target) + '.</p>';
    }
    html += '</div>';

    /* elenco raggruppato per settimana */
    var giorniConTurni = sum.days.filter(function (d) { return d.entries.length > 0; });

    if (!giorniConTurni.length) {
      html += '<div class="empty" style="margin-top:16px"><span class="big">▤</span>' +
        esc(T('Nessun turno registrato in {mese}.', { mese: Calc.fmtMonth(mese) })) + '<br>' +
        '<button class="btn primary sm" style="margin-top:14px" data-action="new-shift" data-date="' + from + '">Aggiungi il primo</button></div>';
      return html;
    }

    /* Un turno lasciato a metà è facile da dimenticare una seconda volta:
       vale la pena dire quanti sono, invece di lasciarli trovare per caso. */
    var daCompletare = 0;
    giorniConTurni.forEach(function (d) {
      d.entries.forEach(function (t) { if (Calc.turnoIncompleto(t)) daCompletare++; });
    });
    if (daCompletare) {
      html += '<div class="note" style="margin-top:16px;border-color:var(--warn)">' +
        esc(daCompletare === 1
          ? T('Un turno di questo mese ha un solo orario e non conta ore: aprilo e completalo.')
          : T('{n} turni di questo mese hanno un solo orario e non contano ore: aprili e completali.', { n: daCompletare })) +
        '</div>';
    }

    var settimane = {};
    giorniConTurni.forEach(function (d) {
      var k = Calc.weekStart(d.date, st.inizioSettimana);
      if (!settimane[k]) settimane[k] = [];
      settimane[k].push(d);
    });

    Object.keys(settimane).sort().reverse().forEach(function (k) {
      var days = settimane[k].slice().reverse();
      var wSum = Calc.rangeSummary(k, Calc.addDays(k, 6), shifts, st);
      html += '<div class="day-group-head"><span>Settimana ' + Calc.isoWeekNumber(k) + '</span>' +
        '<span>' + Calc.fmtDuration(wSum.worked) + ' · ' + Calc.fmtPct(wSum.pct) + '</span></div>';
      days.forEach(function (d) {
        d.entries.forEach(function (s) { html += shiftRow(s); });
      });
    });

    return html;
  }

  /* =========================================================
     STATISTICHE
     ========================================================= */
  function statistiche(ctx) {
    var st = Store.settings();
    var shifts = Store.shifts();
    var oggi = Calc.today();
    var anno = ctx.statsYear || Calc.fromISO(oggi).getFullYear();

    var html = '';

    /* andamento ultime 12 settimane */
    var serie = [];
    for (var i = 11; i >= 0; i--) {
      var ws = Calc.addDays(Calc.weekStart(oggi, st.inizioSettimana), -7 * i);
      var s = Calc.rangeSummary(ws, Calc.addDays(ws, 6), shifts, st);
      serie.push({ label: 'S' + Calc.isoWeekNumber(ws), value: s.pct, sum: s });
    }

    html += '<div class="card">';
    html += '<div class="card-title">Percentuale settimanale — ultime 12 settimane</div>';
    html += Charts.line(serie, { height: 180 });
    var mediaPct = serie.reduce(function (a, b) { return a + b.value; }, 0) / (serie.length || 1);
    var oreTot = serie.reduce(function (a, b) { return a + b.sum.worked; }, 0);
    var strTot = serie.reduce(function (a, b) { return a + b.sum.overtime; }, 0);
    html += '<div class="grid grid-3" style="margin-top:14px">';
    html += stat('Media', Calc.fmtPct(mediaPct), 'delle ore previste', 'sm');
    html += stat('Ore totali', Calc.fmtHours(oreTot, 0), '12 settimane', 'sm');
    html += stat('Straordinari', Calc.fmtHours(strTot, 1), st.pagaOraria > 0 && strTot > 0 ? '≈ ' + Calc.fmtMoney(Calc.overtimePay(strTot, st), st) : '', 'sm');
    html += '</div></div>';

    /* riepilogo mensile dell'anno */
    html += '<div class="card" style="margin-top:14px">';
    html += '<div class="row-between"><div class="card-title">Riepilogo ' + anno + '</div>' +
      '<div class="row" style="gap:6px">' +
      '<button class="btn sm ghost" data-action="year" data-delta="-1">‹</button>' +
      '<button class="btn sm ghost" data-action="year" data-delta="1">›</button>' +
      '</div></div>';

    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Mese</th><th>Lavorate</th><th>Previste</th><th>%</th><th>Straord.</th><th>Saldo</th>' +
      '</tr></thead><tbody>';

    var totali = { worked: 0, target: 0, overtime: 0, saldo: 0 };
    var righe = 0;
    for (var mIdx = 0; mIdx < 12; mIdx++) {
      var iso = anno + '-' + Calc.pad(mIdx + 1) + '-01';
      var sum = Calc.rangeSummary(Calc.monthStart(iso), Calc.monthEnd(iso), shifts, st, {
        targetOverrideMinutes: st.oreMensiliFisse > 0 ? Math.round(st.oreMensiliFisse * 60) : 0
      });
      if (sum.worked === 0 && sum.absence === 0) continue;
      // Per il mese in corso il confronto è con le ore previste fino a oggi.
      var parziale = sum.inCorso && sum.targetToDate < sum.target;
      var tgt = parziale ? sum.targetToDate : sum.target;
      var pct = parziale ? sum.pctToDate : sum.pct;
      var saldo = parziale ? sum.saldoToDate : sum.saldo;
      righe++;
      totali.worked += sum.worked;
      totali.target += tgt;
      totali.overtime += sum.overtime;
      totali.saldo += saldo;
      html += '<tr>' +
        '<td>' + esc(Calc.MESI[mIdx]) + (parziale ? ' <span class="tiny muted">in corso</span>' : '') + '</td>' +
        '<td>' + Calc.fmtHours(sum.worked) + '</td>' +
        '<td>' + Calc.fmtHours(tgt) + '</td>' +
        '<td style="color:' + Charts.colorFor(pct) + '">' + Calc.fmtPct(pct) + '</td>' +
        '<td>' + (sum.overtime ? Calc.fmtHours(sum.overtime) : '—') + '</td>' +
        '<td>' + (saldo >= 0 ? '+' : '−') + Calc.fmtDuration(Math.abs(saldo)) + '</td>' +
        '</tr>';
    }

    if (!righe) {
      html += '<tr><td colspan="6" class="muted center" style="padding:22px">Nessun dato per il ' + anno + '.</td></tr>';
    } else {
      html += '<tr style="border-top:2px solid var(--line);font-weight:700">' +
        '<td>Totale</td>' +
        '<td>' + Calc.fmtHours(totali.worked, 0) + '</td>' +
        '<td>' + Calc.fmtHours(totali.target, 0) + '</td>' +
        '<td>' + Calc.fmtPct(totali.target > 0 ? (totali.worked / totali.target) * 100 : 0) + '</td>' +
        '<td>' + Calc.fmtHours(totali.overtime, 1) + '</td>' +
        '<td>' + (totali.saldo >= 0 ? '+' : '−') + Calc.fmtDuration(Math.abs(totali.saldo)) + '</td>' +
        '</tr>';
    }
    html += '</tbody></table></div></div>';

    /* distribuzione per giorno della settimana */
    var perGiorno = [0, 0, 0, 0, 0, 0, 0];
    var contGiorno = [0, 0, 0, 0, 0, 0, 0];
    var da = Calc.addDays(oggi, -83);
    Calc.rangeSummary(da, oggi, shifts, st).days.forEach(function (d) {
      var g = Calc.dow(d.date);
      perGiorno[g] += d.worked;
      if (d.worked > 0) contGiorno[g]++;
    });

    var ordine = [1, 2, 3, 4, 5, 6, 0];
    html += '<div class="card" style="margin-top:14px">';
    html += '<div class="card-title">Ore medie per giorno della settimana — ultime 12 settimane</div>';
    html += Charts.bars(ordine.map(function (g) {
      var media = contGiorno[g] > 0 ? perGiorno[g] / contGiorno[g] / 60 : 0;
      return {
        label: Calc.GIORNI_BREVI[g],
        value: media,
        color: (st.giorniLavorativi || []).indexOf(g) >= 0 ? 'var(--accent)' : 'var(--violet)',
        title: Calc.GIORNI[g] + ': ' + T('media {ore} h su {n} turni', { ore: media.toFixed(1).replace('.', ','), n: contGiorno[g] })
      };
    }), { height: 170 });
    html += '<p class="tiny muted" style="margin:10px 0 0">In viola i giorni fuori dal tuo calendario contrattuale.</p>';
    html += '</div>';

    return html;
  }

  /* =========================================================
     BENESSERE
     ========================================================= */
  function benessere(ctx) {
    var st = Store.settings();
    var shifts = Store.shifts();
    var html = '';

    html += '<div class="note">' +
      '<strong>Come funziona.</strong> Questa sezione incrocia i dati oggettivi dei tuoi turni (ore, straordinari, giorni consecutivi, pause) ' +
      'con un questionario di 16 domande su energia, sonno, confini e motivazione. Il risultato è un profilo di rischio con consigli pratici. ' +
      'È uno strumento di auto-osservazione: non sostituisce il parere di un medico o di uno psicologo.' +
      '</div>';

    // Distinzione che vale la pena fare esplicitamente: qui sotto non c'è
    // nessun modello, ci sono formule. L'IA è solo la conversazione in fondo.
    html += '<p class="tiny muted" style="margin:8px 0 0">Punteggio e consigli sono calcolati sul tuo dispositivo da regole fisse, non da un\'intelligenza artificiale: a parità di dati il risultato è sempre lo stesso. L\'unica parte che usa un modello è la conversazione facoltativa in fondo alla pagina.</p>';

    /* questionario aperto */
    if (ctx.quizOpen) {
      // Le risposte riguardano la salute: prima del consenso esplicito il
      // questionario non si apre, così non esistono proprio dati da trattare.
      if (!Store.consenso('benessere')) return html + consensoBenessere();
      return html + quiz(ctx);
    }

    var last = Store.lastCheckin();
    var evalRes = Coach.evaluate(last ? last.answers : null, shifts, st);

    /* riepilogo */
    html += '<div class="card pad-lg" style="margin-top:14px">';
    html += '<div class="row-between" style="margin-bottom:16px">';
    html += '<div class="card-title" style="margin:0">Profilo attuale</div>';
    html += '<button class="btn primary sm" data-action="start-quiz">' + (last ? 'Nuovo check-in' : 'Compila il check-in') + '</button>';
    html += '</div>';

    if (evalRes.score === null || evalRes.score === undefined) {
      html += '<p class="muted">Registra almeno tre giornate di lavoro oppure compila il check-in per ottenere una valutazione.</p>';
    } else {
      html += '<div class="pct-hero">';
      html += Charts.donut(evalRes.score, {
        size: 128,
        label: evalRes.score + '',
        sub: 'indice di rischio',
        color: evalRes.level.tone === 'ok' ? 'var(--ok)' : (evalRes.level.tone === 'warn' ? 'var(--warn)' : 'var(--bad)')
      });
      html += '<div class="pct-hero-info">';
      html += '<span class="badge ' + evalRes.level.tone + '">' + esc(evalRes.level.label) + '</span>';
      html += '<p style="margin:10px 0 0;max-width:56ch">' + esc(evalRes.level.msg) + '</p>';
      // Due frasi, due elementi: incollarle produrrebbe una chiave che cambia
      // a ogni check-in, perché conterrebbe la data.
      html += '<p class="tiny muted" style="margin:8px 0 0">' +
        '<span>0 = nessun segnale critico · 100 = tutti gli indicatori sopra soglia.</span> ' +
        '<span>' + (last
          ? esc(T('Basato sul check-in del {data} e sui turni delle ultime 4 settimane.', { data: dataLocale(last.ts) }))
          : 'Basato solo sui dati dei turni: compila il check-in per una lettura più precisa.') + '</span></p>';
      html += '</div></div>';
    }
    html += '</div>';

    /* dimensioni */
    if (last && last.dims) {
      html += '<div class="card" style="margin-top:14px"><div class="card-title">Aree del questionario</div>';
      Object.keys(Coach.DIMENSIONS).forEach(function (k) {
        var v = last.dims[k];
        if (v === null || v === undefined) return;
        html += '<div class="dim-row">' +
          '<span title="' + esc(Coach.DIMENSIONS[k].desc) + '">' + esc(Coach.DIMENSIONS[k].label) + '</span>' +
          Charts.meter(v, v >= 65 ? 'var(--bad)' : (v >= 40 ? 'var(--warn)' : 'var(--ok)')) +
          '<span class="tiny muted" style="text-align:right">' + v + '</span>' +
          '</div>';
      });
      html += '<p class="tiny muted" style="margin:12px 0 0">Valori più alti indicano maggiore criticità nell\'area.</p></div>';
    }

    /* indicatori oggettivi */
    var m = evalRes.metrics;
    if (m.datiSufficienti) {
      html += '<div class="card" style="margin-top:14px"><div class="card-title">Indicatori dai turni — ultime 4 settimane</div>';
      html += '<div class="grid grid-4">';
      html += stat('Media settimanale', m.mediaSettimanale.toFixed(1).replace('.', ',') + ' h',
        m.mediaSettimanale > 48 ? 'oltre le 48 h' : 'entro le 48 h', 'sm');
      html += stat('Straordinari', m.straordinari28.toFixed(1).replace('.', ',') + ' h', '28 giorni', 'sm');
      html += stat('Giorni di riposo', m.giorniRiposo28 + '', 'su 28', 'sm');
      html += stat('Max giorni di fila', m.streakMax + '', m.streakCorrente > 0 ? 'ora ' + m.streakCorrente : 'in pausa', 'sm');
      html += stat('Giornate ≥ 10 h', m.giorniLunghi + '', '', 'sm');
      html += stat('Senza pausa', m.giorniSenzaPausa + '', 'giornate lunghe', 'sm');
      html += stat('Turni serali/notturni', m.turniNotturni + '', '', 'sm');
      html += stat('Variabilità', m.variabilitaSettimanale.toFixed(1).replace('.', ',') + ' h', 'fra settimane', 'sm');
      html += '</div></div>';
    }

    /* consigli */
    if (evalRes.advice.length) {
      html += '<div class="card" style="margin-top:14px"><div class="card-title">Consigli</div>';
      evalRes.advice.forEach(function (a) {
        html += '<div class="advice p' + a.priority + '">';
        html += '<h4>' + esc(a.title) + '</h4>';
        html += '<p>' + esc(a.text) + '</p>';
        if (a.actions && a.actions.length) {
          html += '<ul>' + a.actions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
        }
        html += '</div>';
      });
      html += '<p class="tiny muted" style="margin:18px 0 0">Se il malessere è intenso o dura da settimane, parlarne con il medico di base, con uno psicologo o con il medico competente aziendale è la mossa più efficace. In caso di emergenza: 112. Telefono Amico: 02 2327 2327.</p>';
      html += '</div>';
    }

    /* storico */
    var storico = Store.checkins();
    if (storico.length > 1) {
      html += '<div class="card" style="margin-top:14px"><div class="card-title">Andamento dei check-in</div>';
      html += Charts.line(storico.slice(-12).map(function (c) {
        return { label: new Date(c.ts).toLocaleDateString(I18n.lingua(), { day: 'numeric', month: 'short' }), value: c.score };
      }), { height: 160 });
      html += '<p class="tiny muted" style="margin:10px 0 0">La linea al 100% non è un obiettivo: qui conta la direzione, verso il basso è meglio.</p>';
      html += '</div>';
    }

    /* IA opzionale */
    html += aiPanel(ctx);

    return html;
  }

  function consensoBenessere() {
    var html = '<div class="card" style="margin-top:14px"><div class="consenso">';
    html += '<h4>Prima di cominciare serve il tuo consenso</h4>';
    html += '<p>Le domande riguardano sonno, energia, recupero e ansia legata al lavoro. Sono informazioni sulla tua salute, e per trattarle il Regolamento europeo chiede un consenso dato in modo esplicito.</p>';
    html += '<ul>';
    html += '<li>Le risposte e il punteggio restano su questo dispositivo e, se hai fatto l\'accesso, sul tuo account. Nessun altro utente li vede.</li>';
    html += '<li>Servono solo a calcolare il tuo indice di rischio e i consigli, che l\'applicazione genera sul dispositivo con regole fisse, senza mandare niente a nessuno.</li>';
    html += '<li>Puoi revocare il consenso quando vuoi dalle impostazioni, e cancellare i check-in già salvati.</li>';
    html += '</ul>';
    html += '<div class="row" style="gap:8px">';
    html += '<button class="btn primary sm" data-action="consenti" data-consenso="benessere">Acconsento, apri il questionario</button>';
    html += '<button class="btn sm ghost" data-action="cancel-quiz">Non ora</button>';
    html += '<button class="btn sm ghost" data-action="doc" data-doc="privacy">Leggi l\'informativa</button>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function consensoIA() {
    var html = '<div class="consenso">';
    html += '<h4>Serve il tuo consenso per usare l\'intelligenza artificiale</h4>';
    html += '<p>La conversazione è l\'unica parte dell\'applicazione che manda dei dati fuori dal tuo dispositivo. Vale la pena sapere esattamente quali.</p>';
    html += '<ul>';
    html += '<li>Viene inviato a Google, che fornisce il modello, un riepilogo aggregato: ore, media settimanale, straordinari, giorni di riposo, turni notturni e il punteggio dell\'ultimo check-in.</li>';
    html += '<li>Non vengono inviati i singoli turni, le note che scrivi, la tua posizione, la tua email né il tuo nome utente.</li>';
    html += '<li>La richiesta passa dal nostro server, che aggiunge le istruzioni per il modello e conta i messaggi del mese. Il testo della conversazione non viene conservato.</li>';
    html += '<li>Stai scrivendo a un modello linguistico, non a una persona: può sbagliare, non è un medico e non decide niente al posto tuo.</li>';
    html += '</ul>';
    html += '<div class="row" style="gap:8px">';
    html += '<button class="btn primary sm" data-action="consenti" data-consenso="ia">Acconsento</button>';
    html += '<button class="btn sm ghost" data-action="doc" data-doc="ia">Come viene usata l\'IA</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function quiz(ctx) {
    var answers = ctx.quizAnswers || {};
    var risposte = Object.keys(answers).length;
    var tot = Coach.QUESTIONS.length;

    var html = '<div class="card pad-lg" style="margin-top:14px">';
    html += '<div class="row-between" style="margin-bottom:6px">';
    html += '<div class="card-title" style="margin:0">Check-in benessere</div>';
    html += '<span class="tiny muted">' + risposte + ' / ' + tot + '</span>';
    html += '</div>';
    html += Charts.meter((risposte / tot) * 100, 'var(--accent)');
    html += '<p class="small muted" style="margin:12px 0 18px">Pensa alle <strong>ultime due settimane</strong>. Non esistono risposte giuste: rispondi di getto.</p>';

    Coach.QUESTIONS.forEach(function (q, i) {
      html += '<div class="q">';
      html += '<div class="q-text">' + (i + 1) + '. ' + esc(q.text) + '</div>';
      html += '<div class="q-scale">';
      Coach.SCALE.forEach(function (label, v) {
        var on = answers[q.id] === v ? ' on' : '';
        html += '<button type="button" class="q-opt' + on + '" data-action="answer" data-q="' + q.id + '" data-v="' + v + '">' + esc(label) + '</button>';
      });
      html += '</div></div>';
    });

    html += '<div class="row" style="margin-top:20px;gap:10px">';
    html += '<button class="btn primary" data-action="save-quiz"' + (risposte < tot ? ' disabled' : '') + '>Salva check-in</button>';
    html += '<button class="btn ghost" data-action="cancel-quiz">Annulla</button>';
    if (risposte < tot) html += '<span class="tiny muted">Mancano ' + (tot - risposte) + ' risposte</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  /* Quota del mese, come riga leggibile. Restituisce '' quando non si sa
     ancora niente: un "0 di 0" mentre il dato arriva sembra un divieto. */
  function rigaQuota() {
    var s = AI.stato();
    if (!s.caricato) return '';
    if (s.limite === -1) return T('Messaggi illimitati con il tuo ruolo.');
    var restanti = Math.max(0, (s.limite || 0) - (s.usati || 0));
    return T('{restanti} messaggi rimasti questo mese, su {limite}.', { restanti: restanti, limite: s.limite || 0 });
  }

  function distintiviRuoli() {
    var r = AI.stato().ruoli || [];
    if (!r.length) return '';
    return '<div class="row" style="gap:6px;margin-bottom:10px">' + r.map(function (x) {
      return '<span class="badge ' + esc(x.colore || '') + '" data-no-i18n title="' + esc(x.descrizione || '') + '">' + esc(x.etichetta) + '</span>';
    }).join('') + '</div>';
  }

  function aiPanel(ctx) {
    var html = '<div class="card" style="margin-top:14px">';
    html += '<div class="card-title">Approfondimento con l\'IA (opzionale)</div>';

    // Senza account non c'è quota da contare, quindi non c'è conversazione.
    if (!AI.disponibile()) {
      html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">' +
        'L\'analisi qui sopra è calcolata interamente sul tuo dispositivo e non richiede alcuna configurazione. ' +
        'La conversazione libera che ragiona sui tuoi numeri richiede invece l\'accesso, perché i messaggi disponibili ogni mese sono legati al tuo account.</p>';
      html += '<button class="btn sm" data-action="goto" data-view="impostazioni">Vai alle impostazioni</button>';
      html += '</div>';
      return html;
    }

    // Consenso mai dato: è un atto separato, e va chiesto prima della prima
    // richiesta perché è la prima richiesta a far uscire i dati dal dispositivo.
    if (!Store.consenso('ia')) {
      html += consensoIA();
      html += '</div>';
      return html;
    }

    html += distintiviRuoli();

    // Dichiarazione di trasparenza: chi legge deve sapere subito con che cosa
    // sta parlando, non dedurlo dal tono delle risposte.
    html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">Stai per scrivere a un sistema di intelligenza artificiale: il modello Gemini di Google, non una persona. Le risposte possono contenere errori e non sostituiscono un parere medico.</p>';

    var chat = ctx.chat || [];
    html += '<div class="chat" id="chat">';
    if (!chat.length) {
      // Il nome del pulsante non si cita: in un'altra lingua sarebbe tradotto
      // di qua e non di là, e la frase manderebbe a cercare un pulsante che
      // non esiste. "Qui sotto" resta vero in tutte le lingue.
      html += '<div class="msg ai">Posso ragionare sui tuoi dati: ore, straordinari, giorni consecutivi e ultimo check-in. Chiedimi qualcosa, oppure usa il pulsante qui sotto per una lettura completa del periodo.</div>';
    }
    chat.forEach(function (m) {
      if (m.role === 'user') {
        html += '<div class="msg me" data-no-i18n>' + esc(m.content) + '</div>';
      } else {
        // Ogni risposta porta la sua etichetta: l'obbligo di far riconoscere
        // un contenuto generato non si assolve con una nota a fondo pagina.
        html += '<div class="msg ai"><span class="msg-ia-tag">' + esc(T('Generato dall\'IA')) + '</span>' +
          '<span data-no-i18n>' + esc(m.content) + '</span></div>';
      }
    });
    if (ctx.aiBusy) html += '<div class="msg ai muted">Sto elaborando…</div>';
    html += '</div>';

    html += '<div class="row" style="margin-top:12px;gap:8px">';
    html += '<input id="ai-input" type="text" placeholder="Scrivi una domanda…" style="flex:1;min-width:180px"' + (ctx.aiBusy ? ' disabled' : '') + '>';
    html += '<button class="btn primary" data-action="ai-send"' + (ctx.aiBusy ? ' disabled' : '') + '>Invia</button>';
    html += '</div>';
    html += '<div class="row" style="margin-top:8px;gap:8px">';
    html += '<button class="btn sm ghost" data-action="ai-analyze"' + (ctx.aiBusy ? ' disabled' : '') + '>Analizza i miei dati</button>';
    if (chat.length) html += '<button class="btn sm ghost" data-action="ai-clear">Svuota conversazione</button>';
    html += '</div>';
    var quota = rigaQuota();
    if (quota) html += '<p class="tiny muted" style="margin:10px 0 0" data-no-i18n>' + esc(quota) + '</p>';
    html += '<p class="tiny muted" style="margin:4px 0 0">I dati inviati sono il riepilogo aggregato dei turni e l\'ultimo check-in, non i singoli turni né le note.</p>';
    html += '<div class="row" style="gap:8px;margin-top:8px">' +
      '<button class="btn sm ghost" data-action="doc" data-doc="ia">Come viene usata l\'IA</button>' +
      '<button class="btn sm ghost" data-action="revoca-ia">Revoca il consenso</button>' +
      '</div>';
    html += '</div>';
    return html;
  }

  /* Riassunto in una riga dello stato della sincronizzazione. */
  function statoCloud() {
    var cfg = global.CONFIG || {};
    if (!cfg.CLERK_PUBLISHABLE_KEY) return 'chiave Clerk assente';
    if (!global.Cloud) return 'modulo cloud.js non caricato';
    var st = global.Cloud.stato();
    if (st.utente) return 'accesso effettuato';
    if (!st.pronto) return 'accesso in caricamento';
    if (st.motivo === 'irraggiungibile') return 'librerie non raggiungibili';
    return 'pronto per l\'accesso';
  }

  /* Righe di stato da leggere quando l'accesso non parte. Servono a capire
     in quale dei passaggi ci si è fermati senza aprire la console. */
  function diagnostica(st) {
    var cfg = global.CONFIG || {};
    var righe = [
      'chiave Clerk: ' + (cfg.CLERK_PUBLISHABLE_KEY
        ? 'presente (' + esc(cfg.CLERK_PUBLISHABLE_KEY.slice(0, 12)) + '…)'
        : 'assente'),
      'server: ' + (cfg.SUPABASE_URL ? 'configurato' : 'assente')
    ];
    if (st) {
      righe.push('librerie: ' + (st.disponibile ? 'caricate' : 'non caricate'));
      if (st.motivo) righe.push('stato: ' + esc(st.motivo));
      if (st.dettaglio) righe.push('dettaglio: ' + esc(st.dettaglio));
    }
    return '<p class="tiny muted" style="margin:12px 0 0">' + righe.join(' · ') + '</p>';
  }

  /* Account e sincronizzazione: gli stessi dati sul telefono e sul computer. */
  function accountCard() {
    var cloud = global.Cloud;
    var html = '<div class="card"><div class="card-title">Account</div>';

    // Le tre ragioni per cui l'accesso può non essere disponibile sono diverse
    // fra loro e si risolvono in modi diversi: vanno distinte, non riassunte
    // in un unico "non è configurato" che manda a cercare nel posto sbagliato.
    if (!cloud) {
      html += '<div class="note" style="margin-bottom:12px">Il modulo di sincronizzazione non è stato caricato.</div>';
      html += '<p class="small muted" style="margin:0;max-width:64ch">' +
        'Manca <code>js/cloud.js</code>, oppure il browser ne ha in memoria una versione vecchia. ' +
        'Ricarica tenendo premuto <kbd>Ctrl</kbd> (su Mac <kbd>Cmd</kbd>) mentre premi il pulsante di ricarica. ' +
        'Nel frattempo il sito funziona, ma i dati restano solo su questo dispositivo.</p>';
      html += '</div>';
      return html;
    }

    if (!cloud.configurato()) {
      html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">' +
        'La sincronizzazione con l\'app per telefono non è ancora configurata: manca la chiave di Clerk in <code>js/config.js</code>. ' +
        'Finché non c\'è, il sito funziona normalmente ma i dati restano solo su questo dispositivo.</p>';
      html += diagnostica(null);
      html += '</div>';
      return html;
    }

    var st = cloud.stato();

    if (st.errore && !st.utente) {
      html += '<div class="note" style="margin-bottom:12px">' + esc(st.errore) + '</div>';
    }

    if (!st.utente) {
      html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">' +
        'Accedi con la tua email per ritrovare gli stessi turni sull\'app del telefono. ' +
        'Senza accesso il sito continua a funzionare, ma solo in locale.</p>';
      // Il bottone resta cliccabile anche dopo un errore: quasi sempre è la rete
      // che ha avuto un singhiozzo, e un secondo tentativo basta.
      html += '<button class="btn primary sm" data-action="cloud-login"' + (st.pronto ? '' : ' disabled') + '>' +
        (st.pronto ? (st.motivo === 'irraggiungibile' ? 'Riprova ad accedere' : 'Accedi') : 'Caricamento…') + '</button>';
      if (!st.disponibile) html += diagnostica(st);
    } else {
      var pendenti = Store.syncState();
      var daInviare = pendenti.dirtyShifts.length + pendenti.dirtyCheckins.length +
        pendenti.deletedShifts.length + pendenti.deletedCheckins.length +
        (pendenti.dirtySettings ? 1 : 0) + (pendenti.dirtyPunch ? 1 : 0);

      html += '<div class="row-between">';
      html += '<div><strong>' + esc(st.utente.email || 'Accesso effettuato') + '</strong>' +
        '<p class="tiny muted" style="margin:4px 0 0">' +
        (st.ultimaSync
          ? T('Ultima sincronizzazione {quando}', { quando: new Date(st.ultimaSync).toLocaleString(I18n.lingua()) })
          : 'Non ancora sincronizzato') +
        (daInviare > 0 ? ' · ' + daInviare + ' modifiche da inviare' : '') +
        '</p></div>';
      html += '<button class="btn sm" data-action="cloud-sync"' + (st.sincronizzando ? ' disabled' : '') + '>' +
        (st.sincronizzando ? 'Sincronizzo…' : 'Sincronizza') + '</button>';
      html += '</div>';

      if (st.errore) html += '<div class="note" style="margin-top:12px;border-color:var(--bad)">' + esc(st.errore) + '</div>';

      html += '<p class="tiny muted" style="margin:12px 0 0">Gli stessi dati sono nell\'app per telefono, accedendo con questa email.</p>';
      html += '<button class="btn sm danger" style="margin-top:12px" data-action="cloud-logout">Esci dall\'account</button>';
    }

    html += '</div>';
    return html;
  }

  /* =========================================================
     IMPOSTAZIONI
     ========================================================= */

  /* =========================================================
     AMMINISTRAZIONE — visibile solo a chi il server riconosce
     come amministratore. Il filtro vero è nelle policy del
     database: qui si evita soltanto di mostrare una scheda
     che risponderebbe vuota.
     ========================================================= */

  function jsonArea(id, valore, righe) {
    return '<textarea id="' + id + '" rows="' + (righe || 8) + '" spellcheck="false" ' +
      'style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px">' +
      esc(JSON.stringify(valore === null || valore === undefined ? {} : valore, null, 2)) +
      '</textarea>';
  }

  function rigaTurnoAdmin(t) {
    var tipi = Object.keys(Calc.TIPI).map(function (k) {
      return '<option value="' + k + '"' + (t.tipo === k ? ' selected' : '') + '>' + esc(Calc.TIPI[k].label) + '</option>';
    }).join('');
    return '<tr data-riga="' + esc(t.id) + '"' + (t.deleted_at ? ' style="opacity:.5"' : '') + '>' +
      '<td><input type="date" data-campo="date" value="' + esc(t.date || '') + '"></td>' +
      '<td><input type="time" data-campo="start_time" value="' + esc(t.start_time || '') + '"></td>' +
      '<td><input type="time" data-campo="end_time" value="' + esc(t.end_time || '') + '"></td>' +
      '<td><input type="number" min="0" step="5" data-campo="break_min" value="' + esc(t.break_min || 0) + '" style="max-width:80px"></td>' +
      '<td><select data-campo="tipo">' + tipi + '</select></td>' +
      '<td><input type="text" data-campo="note" value="' + esc(t.note || '') + '" maxlength="400"></td>' +
      '<td class="tiny muted">' + (t.deleted_at ? esc(T('eliminato')) : '') + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn sm" data-action="admin-salva-turno">' + esc(T('Salva')) + '</button> ' +
        '<button class="btn sm danger" data-action="admin-elimina-turno">' + esc(T('Elimina')) + '</button>' +
      '</td></tr>';
  }

  /* Distintivi dei ruoli di un utente, con l'etichetta presa dal catalogo:
     nella tabella c'è il codice, che è quello che il database conosce. */
  function badgeRuoli(codici, catalogo) {
    if (!codici || !codici.length) return '<span class="tiny muted">—</span>';
    var per = {};
    (catalogo || []).forEach(function (r) { per[r.codice] = r; });
    return codici.map(function (c) {
      var def = per[c] || {};
      return '<span class="badge ' + esc(def.colore || '') + '" data-no-i18n>' + esc(def.etichetta || c) + '</span>';
    }).join(' ');
  }

  /* Solo cifre: "12 / 200" non ha bisogno di traduzione e non produce una
     chiave per ogni possibile frazione. */
  function usoIA(u) {
    return (u.ia_mese || 0) + ' / ' + (u.ia_limite === -1 ? '∞' : (u.ia_limite || 0));
  }

  /* Assegnazione dei ruoli: il catalogo intero, con acceso ciò che l'utente
     ha già. Un elenco a tendina nasconderebbe proprio l'informazione che
     serve mentre si assegna, cioè che cosa ha già. */
  function cardRuoli(ctx, userId) {
    var catalogo = ctx.adminRuoli;
    var utente = (ctx.adminUtenti || []).filter(function (u) { return u.user_id === userId; })[0];
    var attuali = (utente && utente.ruoli) || [];

    var html = '<div class="card"><div class="card-title">Ruoli e vantaggi</div>';
    if (!catalogo) {
      html += '<p class="muted small" style="margin:0">' + esc(T('Caricamento…')) + '</p></div>';
      return html;
    }
    html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">Tocca un ruolo per assegnarlo o toglierlo. Con più ruoli vale il vantaggio migliore. Il catalogo si modifica dalla tabella "ruoli" nel pannello Supabase.</p>';
    html += '<div class="chips">';
    catalogo.forEach(function (r) {
      var on = attuali.indexOf(r.codice) >= 0;
      html += '<button type="button" class="chip' + (on ? ' on' : '') + '"' +
        ' data-action="admin-ruolo" data-utente="' + esc(userId) + '" data-ruolo="' + esc(r.codice) + '"' +
        ' data-attivo="' + (on ? '1' : '0') + '"' +
        ' data-no-i18n title="' + esc(r.descrizione || '') + '">' + esc(r.etichetta) + '</button>';
    });
    html += '</div>';
    html += '<div class="table-wrap" style="margin-top:14px"><table><thead><tr>' +
      '<th>' + esc(T('Ruolo')) + '</th><th>' + esc(T('Messaggi IA al mese')) + '</th>' +
      '<th>' + esc(T('Senza abbonamento')) + '</th><th>' + esc(T('Amministratore')) + '</th>' +
      '</tr></thead><tbody>';
    catalogo.forEach(function (r) {
      html += '<tr><td data-no-i18n>' + esc(r.etichetta) + '</td>' +
        '<td>' + (r.ia_illimitata ? esc(T('illimitati')) : (r.quota_ia === null ? '—' : r.quota_ia)) + '</td>' +
        '<td>' + (r.salta_abbonamento ? esc(T('sì')) : '—') + '</td>' +
        '<td>' + (r.amministratore ? esc(T('sì')) : '—') + '</td></tr>';
    });
    html += '</tbody></table></div>';

    // La chiusura di un account sta qui, sotto i ruoli, e non fra i pulsanti
    // di riga: è l'azione più grave della pagina e non deve capitare accanto
    // a "elimina questo turno".
    var mio = global.Cloud && global.Cloud.stato().utente && global.Cloud.stato().utente.id === userId;
    var amministratore = attuali.some(function (c) {
      var def = (catalogo || []).filter(function (r) { return r.codice === c; })[0];
      return def && def.amministratore;
    });
    html += '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">';
    if (mio) {
      html += '<p class="small muted" style="margin:0">Questo sei tu: il tuo account si chiude dalle impostazioni, non da qui.</p>';
    } else if (amministratore) {
      html += '<p class="small muted" style="margin:0">È un amministratore. Per eliminarlo togli prima il ruolo: un passaggio in più, di proposito.</p>';
    } else {
      html += '<p class="small muted" style="margin:0 0 10px;max-width:64ch">Elimina l\'account, i suoi dati sul server e l\'accesso. La persona riceve un\'email con la motivazione che scrivi. Non è reversibile.</p>';
      html += '<button class="btn sm danger" data-action="admin-elimina-utente" data-utente="' + esc(userId) + '">Elimina questo account</button>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  /* Modulo di eliminazione. La motivazione è obbligatoria perché finisce in
     due posti che contano: l'email alla persona e il registro. Un campo
     facoltativo sarebbe rimasto vuoto proprio nei casi controversi. */
  function formEliminaUtente(u) {
    var html = '';
    html += '<input type="hidden" name="modulo" value="elimina-utente">';
    html += '<input type="hidden" name="user_id" value="' + esc(u.user_id) + '">';
    html += '<h3 style="margin:0">Elimina l\'account</h3>';
    html += '<p class="small" style="margin:0" data-no-i18n>' + esc(u.email || u.user_id) + '</p>';

    html += '<div class="note" style="border-color:color-mix(in srgb, var(--bad) 35%, transparent)">';
    html += '<p style="margin:0 0 8px">Vengono eliminati dal server i suoi turni, i check-in, le impostazioni, i ruoli e l\'anagrafica, e viene chiuso l\'accesso.</p>';
    html += '<p style="margin:0 0 8px">Quello che ha salvato sul proprio dispositivo resta lì: non possiamo cancellarlo a distanza, e l\'email glielo dice.</p>';
    html += '<p style="margin:0">La motivazione che scrivi qui sotto viene inviata a quella persona parola per parola. Scrivila come se dovessi rileggerla davanti a lei.</p>';
    html += '</div>';

    html += '<label class="field">Motivazione (obbligatoria, almeno 10 caratteri)' +
      '<textarea name="motivo" rows="4" maxlength="1000" required placeholder="Es. Uso del servizio in violazione delle condizioni, segnalato il 3 e il 17 agosto."></textarea></label>';
    html += '<p class="tiny muted" style="margin:0" id="motivo-conteggio"></p>';

    html += '<div class="row" style="gap:8px;justify-content:flex-end;margin-top:6px">';
    html += '<button type="button" class="btn ghost" data-action="close-modal">Annulla</button>';
    html += '<button type="submit" class="btn danger">Elimina e invia l\'email</button>';
    html += '</div>';
    return html;
  }

  /* Registro delle eliminazioni: chi, quando, perché, e se l'email è partita. */
  function cardEliminazioni(ctx) {
    var righe = ctx.adminEliminazioni;
    var html = '<div class="card" style="margin-top:14px"><div class="row-between">' +
      '<div class="card-title" style="margin:0">Account eliminati</div>' +
      '<button class="btn sm" data-action="admin-registro">' + esc(T('Ricarica')) + '</button></div>';
    if (!righe) {
      html += '<p class="muted small" style="margin:12px 0 0">' + esc(T('Caricamento…')) + '</p></div>';
      return html;
    }
    if (!righe.length) {
      html += '<p class="muted small" style="margin:12px 0 0">Nessun account eliminato finora.</p></div>';
      return html;
    }
    html += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr>' +
      '<th>' + esc(T('Quando')) + '</th><th>' + esc(T('Utente')) + '</th>' +
      '<th>' + esc(T('Motivazione')) + '</th><th>' + esc(T('Email')) + '</th>' +
      '</tr></thead><tbody>';
    righe.forEach(function (r) {
      html += '<tr>' +
        '<td class="tiny muted" data-no-i18n>' + esc(new Date(r.eseguita_il).toLocaleString(I18n.lingua())) + '</td>' +
        '<td data-no-i18n>' + esc(r.email || r.user_id) + '</td>' +
        '<td class="small" data-no-i18n style="max-width:38ch">' + esc(r.motivo) + '</td>' +
        '<td>' + (r.email_inviata
            ? '<span class="badge ok">' + esc(T('inviata')) + '</span>'
            : '<span class="badge warn">' + esc(T('non inviata')) + '</span>') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="tiny muted" style="margin:12px 0 0">Il registro conserva indirizzo e motivazione anche dopo la cancellazione: serve a rendere conto della decisione e a rispondere se viene contestata. Lo vedono solo gli amministratori.</p>';
    html += '</div>';
    return html;
  }

  function amministrazione(ctx) {
    var st = Admin.stato();
    var html = '';

    if (!st.admin) {
      html += '<div class="card"><div class="card-title">' + esc(T('Amministrazione')) + '</div>';
      html += '<div class="note">' + esc(Admin.diagnosi() || T('Accesso non consentito.')) + '</div>';
      html += '</div>';
      return html;
    }

    html += '<div class="note">' +
      '<strong>' + esc(T('Attenzione.')) + '</strong> ' +
      esc(T('Da qui vedi e modifichi i dati di tutti gli utenti. Le modifiche sono immediate e vengono scaricate dai loro dispositivi alla sincronizzazione successiva. La cancellazione è definitiva.')) +
      '</div>';

    /* elenco utenti */
    html += '<div class="card" style="margin-top:14px">';
    html += '<div class="row-between"><div class="card-title" style="margin:0">' + esc(T('Utenti')) + '</div>' +
      '<button class="btn sm" data-action="admin-ricarica">' + esc(T('Ricarica')) + '</button></div>';

    if (ctx.adminErrore) {
      html += '<div class="note" style="margin-top:12px;border-color:var(--bad)">' + esc(ctx.adminErrore) + '</div>';
    }

    var utenti = ctx.adminUtenti;
    if (!utenti) {
      html += '<p class="muted small" style="margin:12px 0 0">' + esc(T('Caricamento…')) + '</p>';
    } else if (utenti.length === 0) {
      html += '<p class="muted small" style="margin:12px 0 0">' + esc(T('Nessun utente ha ancora sincronizzato dati.')) + '</p>';
    } else {
      html += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr>' +
        '<th>' + esc(T('Utente')) + '</th><th>' + esc(T('Nome utente')) + '</th>' +
        '<th>' + esc(T('Ruoli')) + '</th>' +
        '<th>' + esc(T('Turni')) + '</th><th>' + esc(T('Check-in')) + '</th>' +
        '<th>' + esc(T('IA nel mese')) + '</th>' +
        '<th>' + esc(T('Timbratura')) + '</th><th>' + esc(T('Ultima attività')) + '</th><th></th>' +
        '</tr></thead><tbody>';
      utenti.forEach(function (u) {
        var mio = global.Cloud && global.Cloud.stato().utente && global.Cloud.stato().utente.id === u.user_id;
        html += '<tr>' +
          '<td>' + (u.email
              ? '<span data-no-i18n>' + esc(u.email) + '</span>'
              : '<code style="font-size:12px" data-no-i18n>' + esc(u.user_id) + '</code>') +
            (mio ? ' <span class="badge info">' + esc(T('tu')) + '</span>' : '') +
            (u.email ? '<br><code class="tiny muted" data-no-i18n>' + esc(u.user_id) + '</code>' : '') + '</td>' +
          '<td data-no-i18n>' + esc(u.username || '—') + '</td>' +
          '<td>' + badgeRuoli(u.ruoli, ctx.adminRuoli) + '</td>' +
          '<td>' + u.turni + '</td><td>' + u.checkin + '</td>' +
          '<td class="tiny" data-no-i18n>' + esc(usoIA(u)) + '</td>' +
          '<td>' + (u.timbratura_aperta ? esc(T('aperta')) : '—') + '</td>' +
          '<td class="tiny muted">' + esc(new Date(u.ultima_attivita).toLocaleString(I18n.lingua())) + '</td>' +
          '<td><button class="btn sm" data-action="admin-apri" data-utente="' + esc(u.user_id) + '">' + esc(T('Apri')) + '</button></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<p class="tiny muted" style="margin:12px 0 0">' +
        esc(T('L\'elenco si popola al primo accesso di ciascuno: chi si è registrato prima di questa modifica comparirà quando rientrerà. L\'email è quella del token, non quella dichiarata dal client.')) +
        '</p>';
    }
    html += '</div>';

    html += cardEliminazioni(ctx);

    /* dettaglio di un utente */
    var d = ctx.adminDati;
    if (!d) return html;

    html += '<div class="row-between" style="margin:26px 0 12px">' +
      '<h2 style="margin:0;font-size:17px">' + esc(T('Dati di')) + ' <code style="font-size:13px">' + esc(d.userId) + '</code></h2>' +
      '<button class="btn sm" data-action="admin-chiudi">' + esc(T('Chiudi')) + '</button></div>';

    /* ruoli */
    html += cardRuoli(ctx, d.userId);

    /* turni */
    html += '<div class="card" style="margin-top:14px"><div class="row-between"><div class="card-title" style="margin:0">' +
      esc(T('Turni')) + ' (' + d.shifts.length + ')</div>' +
      '<button class="btn sm primary" data-action="admin-nuovo-turno">' + esc(T('+ Nuovo turno')) + '</button></div>';
    if (d.shifts.length === 0) {
      html += '<p class="muted small" style="margin:12px 0 0">' + esc(T('Nessun turno.')) + '</p>';
    } else {
      html += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr>' +
        '<th>' + esc(T('Data')) + '</th><th>' + esc(T('Inizio')) + '</th><th>' + esc(T('Fine')) + '</th>' +
        '<th>' + esc(T('Pausa (min)')) + '</th><th>' + esc(T('Tipo di giornata')) + '</th><th>' + esc(T('Note (facoltative)')) + '</th>' +
        '<th></th><th></th></tr></thead><tbody>';
      d.shifts.forEach(function (t) { html += rigaTurnoAdmin(t); });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    /* check-in */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">' +
      esc(T('Check-in')) + ' (' + d.checkins.length + ')</div>';
    if (d.checkins.length === 0) {
      html += '<p class="muted small">' + esc(T('Nessun check-in.')) + '</p>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>' + esc(T('Data')) + '</th><th>' + esc(T('Punteggio')) + '</th><th>' + esc(T('Livello')) + '</th><th></th>' +
        '</tr></thead><tbody>';
      d.checkins.forEach(function (c) {
        html += '<tr' + (c.deleted_at ? ' style="opacity:.5"' : '') + '>' +
          '<td class="tiny">' + esc(new Date(Number(c.ts)).toLocaleString(I18n.lingua())) + '</td>' +
          '<td>' + esc(c.score) + '</td><td data-no-i18n>' + esc(c.level || '') + '</td>' +
          '<td><button class="btn sm danger" data-action="admin-elimina-checkin" data-id="' + esc(c.id) + '">' + esc(T('Elimina')) + '</button></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    /* impostazioni e timbratura, come JSON: sono documenti liberi, e un
       modulo con un campo per chiave mentirebbe sulla loro forma */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">' + esc(T('Impostazioni')) + '</div>';
    html += jsonArea('admin-settings', d.settings ? d.settings.data : {}, 12);
    html += '<div class="row" style="margin-top:10px"><button class="btn sm primary" data-action="admin-salva-settings">' +
      esc(T('Salva')) + '</button></div></div>';

    html += '<div class="card" style="margin-top:14px"><div class="card-title">' + esc(T('Timbratura')) + '</div>';
    html += jsonArea('admin-punch', d.punch ? d.punch.punch : null, 8);
    html += '<div class="row" style="margin-top:10px">' +
      '<button class="btn sm primary" data-action="admin-salva-punch">' + esc(T('Salva')) + '</button>' +
      '<button class="btn sm danger" data-action="admin-azzera-punch">' + esc(T('Azzera timbratura')) + '</button>' +
      '</div></div>';

    return html;
  }

  /* Consensi e diritti, in un posto solo e dentro l'applicazione.

     Un'informativa che rimanda a un modulo via email per ogni cosa è
     formalmente a posto e praticamente inutile: qui i tre diritti che si
     possono automatizzare (portabilità, rettifica, cancellazione) sono
     pulsanti, e i consensi si tolgono con lo stesso gesto con cui si danno. */
  function cardPrivacy(connesso) {
    var html = '<div class="card" style="margin-top:14px"><div class="card-title">Privacy, consensi e diritti</div>';

    html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">Che cosa viene raccolto, perché, chi lo vede e per quanto tempo: è tutto scritto nell\'informativa, in italiano leggibile.</p>';
    html += '<div class="row" style="gap:8px;margin-bottom:18px">' +
      '<button class="btn sm" data-action="doc" data-doc="privacy">Informativa privacy</button>' +
      '<button class="btn sm" data-action="doc" data-doc="ia">Come viene usata l\'IA</button>' +
      '</div>';

    html += consensoRiga('benessere', 'Questionario sul benessere',
      'Le risposte riguardano la tua salute: senza consenso il questionario non si apre e nessun dato di questo tipo viene creato.');
    html += consensoRiga('ia', 'Conversazione con l\'intelligenza artificiale',
      'Autorizza l\'invio del riepilogo aggregato dei tuoi dati ad Anthropic quando usi la conversazione. Senza consenso non parte nessuna richiesta.');

    html += '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">';
    html += '<p class="small muted" style="margin:0 0 10px;max-width:64ch">' +
      (connesso
        ? 'Elimina definitivamente i dati sul server, i dati su questo dispositivo e il tuo account. Non è reversibile: se ti serve una copia, esportala prima.'
        : 'Senza accesso non c\'è nessun account da chiudere: qui puoi cancellare i dati di questo dispositivo dal pulsante "Cancella tutto" qui sopra.') +
      '</p>';
    if (connesso) {
      html += '<button class="btn sm danger" data-action="elimina-account">Elimina account e dati</button>';
    }
    html += '</div>';

    html += '<p class="tiny muted" style="margin:14px 0 0">Per ogni altra richiesta sui tuoi dati, o per un reclamo: ' + esc(Legale.contatto) + '</p>';
    html += '</div>';
    return html;
  }

  function consensoRiga(nome, titolo, spiegazione) {
    var dato = Store.consenso(nome);
    var quando = Store.dataConsenso(nome);
    var html = '<div style="margin-top:14px">';
    html += '<label class="row" style="gap:10px;cursor:pointer;align-items:flex-start">';
    html += '<input type="checkbox" data-consenso="' + esc(nome) + '"' + (dato ? ' checked' : '') + ' style="margin-top:3px">';
    html += '<span><span class="small" style="font-weight:600">' + esc(titolo) + '</span>' +
      '<span class="tiny muted" style="display:block;margin-top:3px;max-width:60ch">' + esc(spiegazione) + '</span></span>';
    html += '</label>';
    if (dato && quando) {
      html += '<p class="tiny muted" style="margin:5px 0 0 28px">Consenso dato il <span data-no-i18n>' + esc(dataLocale(quando)) + '</span></p>';
    }
    html += '</div>';
    return html;
  }

  function impostazioni(ctx) {
    ctx = ctx || {};
    var s = Store.settings();
    var giorni = [1, 2, 3, 4, 5, 6, 0];
    var connesso = !!(global.Cloud && global.Cloud.connesso && global.Cloud.connesso());
    var html = '';

    html += accountCard();

    var o = s.orario || {};
    html += '<div class="card"><div class="card-title">Orario standard</div>';
    html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">Sono gli orari abituali della tua giornata. ' +
      'Da qui l\'app ricava le ore contrattuali, precompila i turni inseriti a mano e riconosce la finestra della pausa pranzo.</p>';
    html += '<div class="grid grid-4">';
    html += '<label class="field">Inizio<input type="time" data-set="orario.inizio" value="' + esc(o.inizio || '') + '"></label>';
    html += '<label class="field">Pausa da<input type="time" data-set="orario.pausaInizio" value="' + esc(o.pausaInizio || '') + '"></label>';
    html += '<label class="field">Pausa a<input type="time" data-set="orario.pausaFine" value="' + esc(o.pausaFine || '') + '"></label>';
    html += '<label class="field">Fine<input type="time" data-set="orario.fine" value="' + esc(o.fine || '') + '"></label>';
    html += '</div>';

    html += '<div class="note" style="margin-top:12px">' +
      'Giornata contrattuale calcolata: <strong>' + Calc.fmtDuration(Math.round(s.oreGiornaliere * 60)) + '</strong>' +
      (s.pausaPredefinita > 0 ? ' (pausa di ' + s.pausaPredefinita + ' minuti ' + (s.pausaRetribuita ? 'retribuita' : 'non retribuita') + ')' : ' senza pausa') +
      ' · settimana da <strong>' + Calc.fmtDuration(Math.round(s.oreGiornaliere * 60 * (s.giorniLavorativi || []).length)) + '</strong>. ' +
      'Le percentuali di giorno, settimana e mese sono calcolate su questi valori.</div>';

    html += '<div class="grid grid-2" style="margin-top:14px">';
    html += '<label class="field">Soglia straordinario (ore/giorno)' +
      '<input type="number" min="0" max="24" step="0.25" data-set="sogliaStraordinario" value="' + s.sogliaStraordinario + '"></label>';
    html += '<label class="field">Arrotondamento timbratura (minuti)' +
      '<select data-set="arrotondamento">' +
      [1, 5, 10, 15, 30].map(function (m) {
        return '<option value="' + m + '"' + (Number(s.arrotondamento) === m ? ' selected' : '') + '>' + (m === 1 ? 'Al minuto' : m + ' minuti') + '</option>';
      }).join('') +
      '</select></label>';
    html += '</div>';

    html += '<div style="margin-top:14px"><div class="field" style="margin-bottom:8px">Giorni lavorativi</div><div class="chips">';
    giorni.forEach(function (g) {
      var on = (s.giorniLavorativi || []).indexOf(g) >= 0 ? ' on' : '';
      html += '<button type="button" class="chip' + on + '" data-action="toggle-day" data-day="' + g + '">' + Calc.GIORNI_BREVI[g] + '</button>';
    });
    html += '</div><p class="tiny muted" style="margin:8px 0 0">Il monte ore previsto di settimana e mese è calcolato su questi giorni.</p></div>';

    html += '<div class="grid grid-2" style="margin-top:14px">';
    html += '<label class="field">Monte ore mensile fisso (0 = calcolato)' +
      '<input type="number" min="0" max="400" step="1" data-set="oreMensiliFisse" value="' + s.oreMensiliFisse + '"></label>';
    html += '</div>';

    html += '<label class="row" style="margin-top:14px;gap:10px;cursor:pointer">' +
      '<input type="checkbox" data-set="pausaRetribuita"' + (s.pausaRetribuita ? ' checked' : '') + '>' +
      '<span class="small">La pausa è retribuita e conta come ore lavorate</span></label>';

    html += '<div class="grid grid-2" style="margin-top:14px">';
    html += '<label class="field">Primo giorno della settimana' +
      '<select data-set="inizioSettimana">' +
      // I nomi dei giorni li dà Intl, come ovunque nell'app.
      '<option value="1"' + (s.inizioSettimana === 1 ? ' selected' : '') + '>' + maiuscola(Calc.GIORNI[1]) + '</option>' +
      '<option value="0"' + (s.inizioSettimana === 0 ? ' selected' : '') + '>' + maiuscola(Calc.GIORNI[0]) + '</option>' +
      '</select></label>';
    html += '</div>';
    html += '</div>';

    /* GPS */
    html += Geo.settingsHTML();

    /* economia */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">Straordinari e paga (opzionale)</div>';
    html += '<div class="grid grid-3">';
    html += '<label class="field">Paga oraria lorda (0 = disattiva)' +
      '<input type="number" min="0" step="0.5" data-set="pagaOraria" value="' + s.pagaOraria + '"></label>';
    html += '<label class="field">Maggiorazione straordinario (%)' +
      '<input type="number" min="0" max="200" step="5" data-set="maggiorazione" value="' + s.maggiorazione + '"></label>';
    html += '<label class="field">Valuta' +
      '<input type="text" maxlength="3" data-set="valuta" value="' + esc(s.valuta) + '"></label>';
    html += '</div>';
    html += '<p class="tiny muted" style="margin:10px 0 0">La stima economica è indicativa: non tiene conto di fasce orarie, festivi, contributi o trattenute.</p>';
    html += '</div>';

    /* IA — niente più da configurare: la chiave sta sul server, il modello
       lo decide il servizio, all'utente resta il numero che gli interessa
       davvero, cioè quanti messaggi gli restano. */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">Assistente IA</div>';
    html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">Punteggio di benessere e consigli sono calcolati sul tuo dispositivo e non hanno bisogno di niente. La conversazione libera nella sezione Benessere passa invece dal nostro server, che parla con il modello per conto tuo: non c\'è nessuna chiave da procurarsi e nessuna spesa a tuo carico.</p>';

    if (!connesso) {
      html += '<p class="small muted" style="margin:0 0 12px">Serve l\'accesso: i messaggi disponibili ogni mese sono legati al tuo account.</p>';
    } else {
      html += distintiviRuoli();
      var quotaImp = rigaQuota();
      html += '<p class="small" style="margin:0 0 4px" data-no-i18n>' + esc(quotaImp || T('Caricamento…')) + '</p>';
      html += '<p class="tiny muted" style="margin:0 0 12px">In beta la conversazione è gratuita. Se un giorno diventerà a pagamento, chi ha un ruolo assegnato lo saprà prima.</p>';
      html += '<button class="btn sm" data-action="goto" data-view="benessere">Vai alla conversazione</button>';
    }
    html += '</div>';

    /* dati */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">I tuoi dati</div>';
    // La riga di prima diceva "nessun dato viene inviato a un server": era
    // vera quando l'app era solo locale, ed è diventata falsa il giorno in
    // cui è arrivata la sincronizzazione. Ora dice quello che succede.
    html += '<p class="small muted" style="margin:0 0 4px">' +
      Store.shifts().length + ' turni e ' + Store.checkins().length + ' check-in salvati su questo dispositivo.</p>';
    html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">' +
      (connesso
        ? 'Con l\'accesso effettuato, turni, check-in e impostazioni vengono copiati anche sul server per ritrovarli sugli altri tuoi dispositivi. Le note dei turni fanno parte della copia; la posizione del luogo di lavoro no, resta qui.'
        : 'Senza accesso i dati restano soltanto in questo browser: se lo svuoti, spariscono. Conviene esportare un backup ogni tanto.') +
      '</p>';
    html += '<div class="row" style="gap:8px">' +
      '<button class="btn sm" data-action="export-json">Esporta JSON</button>' +
      '<button class="btn sm" data-action="export-csv">Esporta CSV</button>' +
      '<button class="btn sm" data-action="import">Importa JSON</button>' +
      '<button class="btn sm danger" data-action="wipe">Cancella tutto</button>' +
      '</div>';
    html += '<p class="tiny muted" style="margin:10px 0 0">L\'esportazione è anche il modo di esercitare il diritto di portabilità: JSON e CSV sono formati aperti, leggibili da un\'altra applicazione.</p>';
    html += '<input type="file" id="import-file" accept="application/json,.json" class="hidden">';
    html += '</div>';

    /* privacy, consensi e diritti */
    html += cardPrivacy(connesso);

    /* app */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">App</div>';
    html += '<div class="row-between"><span class="small">Tema</span>' +
      '<div class="chips">' +
      '<button type="button" class="chip' + (s.tema === 'dark' ? ' on' : '') + '" data-action="theme" data-theme="dark">Scuro</button>' +
      '<button type="button" class="chip' + (s.tema === 'light' ? ' on' : '') + '" data-action="theme" data-theme="light">Chiaro</button>' +
      '</div></div>';
    html += '<p class="tiny muted" style="margin:14px 0 0">Work Balance è una web app installabile: su Android usa "Aggiungi a schermata Home" dal menu del browser, su iPhone il pulsante Condividi → "Aggiungi a Home". Una volta installata funziona anche offline.</p>';
    // Riga tecnica: tutto quello che serve a capire un problema di
    // configurazione o di cache, in un posto solo e senza console.
    html += '<p class="tiny muted" style="margin:8px 0 0">Stato tecnico · versione servita: ' +
      (ctx.swVersione ? '<code>' + esc(ctx.swVersione) + '</code>' : 'nessun service worker attivo') +
      ' · ' + statoCloud() + '</p>';
    html += '</div>';

    return html;
  }

  /* =========================================================
     MODALE TURNO
     ========================================================= */
  function shiftForm(shift) {
    var s = Store.settings();
    var isNew = !shift || !shift.id;
    shift = shift || {};
    var tipo = shift.tipo || 'lavoro';

    var html = '';
    html += '<h3 style="margin:0">' + (isNew ? 'Nuovo turno' : 'Modifica turno') + '</h3>';
    html += '<input type="hidden" name="id" value="' + esc(shift.id || '') + '">';

    html += '<label class="field">Data<input type="date" name="date" required value="' + esc(shift.date || Calc.today()) + '"></label>';

    html += '<div class="field" style="gap:8px">Tipo di giornata<div class="chips" id="tipo-chips">';
    Object.keys(Calc.TIPI).forEach(function (k) {
      html += '<button type="button" class="chip' + (tipo === k ? ' on' : '') + '" data-tipo="' + k + '">' + esc(Calc.TIPI[k].label) + '</button>';
    });
    html += '</div></div>';
    html += '<input type="hidden" name="tipo" value="' + esc(tipo) + '">';

    html += '<div id="ore-fields" class="' + (Calc.TIPI[tipo].conteggia === 'ore' ? '' : 'hidden') + '">';
    html += '<div class="grid grid-3">';
    var std = s.orario || {};
    // Su un turno esistente non si reintroduce l'orario standard al posto di
    // quello lasciato vuoto: sarebbe come completarlo di nascosto.
    var proponi = !shift.id;
    html += '<label class="field">Inizio<input type="time" name="start" value="' +
      esc(shift.start || (proponi ? (std.inizio || '09:00') : '')) + '"></label>';
    html += '<label class="field">Fine<input type="time" name="end" value="' +
      esc(shift.end || (proponi ? (std.fine || '18:00') : '')) + '"></label>';
    html += '<label class="field">Pausa (min)<input type="number" name="breakMin" min="0" max="480" step="5" value="' +
      (shift.breakMin !== undefined ? shift.breakMin : s.pausaPredefinita) + '"></label>';
    html += '</div>';
    html += '<p class="tiny muted" style="margin:8px 0 0" id="preview-ore"></p>';
    // Il turno parziale è la risposta a un caso reale (ci si dimentica di
    // timbrare), quindi va spiegato dove serve: dentro il form, non altrove.
    html += '<div class="note" style="margin-top:12px">';
    html += '<p style="margin:0"><strong>Ti sei dimenticato di timbrare? Puoi inserire anche un orario solo.</strong></p>';
    html += '<p style="margin:6px 0 0">Scrivi quello che ricordi con certezza e lascia vuoto l\'altro: il turno viene salvato lo stesso.</p>';
    html += '<p style="margin:6px 0 0">Finché manca un orario il turno resta segnato «Da completare» e vale zero ore. L\'orario mancante non viene inventato, altrimenti le percentuali racconterebbero una giornata che non hai fatto.</p>';
    html += '<p style="margin:6px 0 0">Quando lo ricordi, riapri il turno dalla lista e aggiungi l\'orario che manca: da quel momento le ore vengono conteggiate normalmente.</p>';
    html += '</div>';
    html += '</div>';

    html += '<label class="field">Note (facoltative)<input type="text" name="note" maxlength="200" value="' + esc(shift.note || '') + '"></label>';

    html += '<div class="row" style="gap:8px;justify-content:flex-end">';
    html += '<button type="button" class="btn ghost" data-action="close-modal">Annulla</button>';
    html += '<button type="submit" class="btn primary">Salva</button>';
    html += '</div>';
    return html;
  }

  global.UI = {
    esc: esc,
    amministrazione: amministrazione,
    landing: landing,
    pannelloAccesso: pannelloAccesso,
    documenti: documenti,
    selettoreLingua: selettoreLingua,
    fmtClock: fmtClock,
    punchDetail: punchDetail,
    dashboard: dashboard,
    turni: turni,
    statistiche: statistiche,
    benessere: benessere,
    impostazioni: impostazioni,
    shiftForm: shiftForm,
    formEliminaUtente: formEliminaUtente,
    shiftRow: shiftRow
  };
})(window);
