/* ui.js — rendering delle viste. Ogni funzione restituisce HTML;
   gli eventi sono gestiti in app.js tramite delega. */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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

    var sub;
    if (isLavoro) {
      sub = esc(s.start) + ' – ' + esc(s.end) +
        (s.breakMin ? ' · pausa ' + s.breakMin + 'm' : ' · nessuna pausa') +
        (Calc.isNightShift(s) ? ' · serale/notturno' : '');
    } else {
      sub = (Calc.TIPI[s.tipo] || {}).label || s.tipo;
    }
    if (s.note) sub += ' · ' + esc(s.note);

    return '<div class="shift">' +
      '<div class="shift-date"><div class="d">' + d.getDate() + '</div><div class="m">' + Calc.MESI_BREVI[d.getMonth()] + '</div></div>' +
      '<div class="shift-main">' +
        '<div class="t">' + (isLavoro ? Calc.fmtDuration(min) : tipoBadge(s.tipo)) + '</div>' +
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
      html += '<div class="empty" style="margin-top:16px"><span class="big">▤</span>Nessun turno registrato in ' + esc(Calc.fmtMonth(mese)) + '.<br>' +
        '<button class="btn primary sm" style="margin-top:14px" data-action="new-shift" data-date="' + from + '">Aggiungi il primo</button></div>';
      return html;
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
        title: Calc.GIORNI[g] + ': media ' + media.toFixed(1).replace('.', ',') + ' h su ' + contGiorno[g] + ' turni'
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

    /* questionario aperto */
    if (ctx.quizOpen) {
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
      html += '<p class="tiny muted" style="margin:8px 0 0">0 = nessun segnale critico · 100 = tutti gli indicatori sopra soglia. ' +
        (last ? 'Basato sul check-in del ' + new Date(last.ts).toLocaleDateString('it-IT') + ' e sui turni delle ultime 4 settimane.' : 'Basato solo sui dati dei turni: compila il check-in per una lettura più precisa.') + '</p>';
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
        return { label: new Date(c.ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), value: c.score };
      }), { height: 160 });
      html += '<p class="tiny muted" style="margin:10px 0 0">La linea al 100% non è un obiettivo: qui conta la direzione, verso il basso è meglio.</p>';
      html += '</div>';
    }

    /* IA opzionale */
    html += aiPanel(ctx);

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

  function aiPanel(ctx) {
    var configured = AI.hasKey();
    var html = '<div class="card" style="margin-top:14px">';
    html += '<div class="card-title">Approfondimento con l\'IA (opzionale)</div>';

    if (!configured) {
      html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">' +
        'L\'analisi qui sopra è calcolata interamente sul tuo dispositivo e non richiede alcuna configurazione. ' +
        'Se vuoi anche una conversazione libera che ragioni sui tuoi numeri, puoi collegare una chiave API di Claude ' +
        'dalle Impostazioni: resta salvata solo sul tuo dispositivo e le richieste vanno direttamente ad Anthropic.</p>';
      html += '<button class="btn sm" data-action="goto" data-view="impostazioni">Vai alle impostazioni</button>';
      html += '</div>';
      return html;
    }

    var chat = ctx.chat || [];
    html += '<div class="chat" id="chat">';
    if (!chat.length) {
      html += '<div class="msg ai">Posso ragionare sui tuoi dati: ore, straordinari, giorni consecutivi e ultimo check-in. Chiedimi qualcosa, oppure usa "Analizza i miei dati" per una lettura completa.</div>';
    }
    chat.forEach(function (m) {
      html += '<div class="msg ' + (m.role === 'user' ? 'me' : 'ai') + '">' + esc(m.content) + '</div>';
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
    html += '<p class="tiny muted" style="margin:10px 0 0">I dati inviati sono il riepilogo aggregato dei turni e l\'ultimo check-in, non i singoli turni né le note.</p>';
    html += '</div>';
    return html;
  }

  /* =========================================================
     IMPOSTAZIONI
     ========================================================= */
  function impostazioni() {
    var s = Store.settings();
    var giorni = [1, 2, 3, 4, 5, 6, 0];
    var html = '';

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
      '<option value="1"' + (s.inizioSettimana === 1 ? ' selected' : '') + '>Lunedì</option>' +
      '<option value="0"' + (s.inizioSettimana === 0 ? ' selected' : '') + '>Domenica</option>' +
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

    /* IA */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">Assistente IA (opzionale)</div>';
    html += '<p class="small muted" style="margin:0 0 12px;max-width:64ch">L\'analisi del benessere funziona senza chiave. Aggiungendo una chiave API di Claude sblocchi la conversazione libera nella sezione Benessere. ' +
      'La chiave viene salvata <strong>solo</strong> nel browser di questo dispositivo e usata per chiamare direttamente api.anthropic.com.</p>';
    html += '<div class="grid grid-2">';
    html += '<label class="field">Chiave API<input type="password" id="ai-key" placeholder="sk-ant-..." value="' + esc(Store.get().aiKey) + '"></label>';
    html += '<label class="field">Modello' +
      '<select id="ai-model">' +
      ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'].map(function (m) {
        return '<option value="' + m + '"' + (Store.get().aiModel === m ? ' selected' : '') + '>' + m + '</option>';
      }).join('') +
      '</select></label>';
    html += '</div>';
    html += '<div class="row" style="margin-top:12px;gap:8px">' +
      '<button class="btn sm primary" data-action="save-ai">Salva</button>' +
      (Store.get().aiKey ? '<button class="btn sm danger" data-action="clear-ai">Rimuovi chiave</button>' : '') +
      '</div>';
    html += '</div>';

    /* dati */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">I tuoi dati</div>';
    html += '<p class="small muted" style="margin:0 0 12px">' + Store.shifts().length + ' turni e ' + Store.checkins().length + ' check-in salvati su questo dispositivo. ' +
      'Nessun dato viene inviato a un server, quindi conviene esportare un backup ogni tanto.</p>';
    html += '<div class="row" style="gap:8px">' +
      '<button class="btn sm" data-action="export-json">Esporta JSON</button>' +
      '<button class="btn sm" data-action="export-csv">Esporta CSV</button>' +
      '<button class="btn sm" data-action="import">Importa JSON</button>' +
      '<button class="btn sm danger" data-action="wipe">Cancella tutto</button>' +
      '</div>';
    html += '<input type="file" id="import-file" accept="application/json,.json" class="hidden">';
    html += '</div>';

    /* app */
    html += '<div class="card" style="margin-top:14px"><div class="card-title">App</div>';
    html += '<div class="row-between"><span class="small">Tema</span>' +
      '<div class="chips">' +
      '<button type="button" class="chip' + (s.tema === 'dark' ? ' on' : '') + '" data-action="theme" data-theme="dark">Scuro</button>' +
      '<button type="button" class="chip' + (s.tema === 'light' ? ' on' : '') + '" data-action="theme" data-theme="light">Chiaro</button>' +
      '</div></div>';
    html += '<p class="tiny muted" style="margin:14px 0 0">Percentage è una web app installabile: su Android usa "Aggiungi a schermata Home" dal menu del browser, su iPhone il pulsante Condividi → "Aggiungi a Home". Una volta installata funziona anche offline.</p>';
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
    html += '<label class="field">Inizio<input type="time" name="start" value="' + esc(shift.start || std.inizio || '09:00') + '"></label>';
    html += '<label class="field">Fine<input type="time" name="end" value="' + esc(shift.end || std.fine || '18:00') + '"></label>';
    html += '<label class="field">Pausa (min)<input type="number" name="breakMin" min="0" max="480" step="5" value="' +
      (shift.breakMin !== undefined ? shift.breakMin : s.pausaPredefinita) + '"></label>';
    html += '</div>';
    html += '<p class="tiny muted" style="margin:8px 0 0" id="preview-ore"></p>';
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
    fmtClock: fmtClock,
    punchDetail: punchDetail,
    dashboard: dashboard,
    turni: turni,
    statistiche: statistiche,
    benessere: benessere,
    impostazioni: impostazioni,
    shiftForm: shiftForm,
    shiftRow: shiftRow
  };
})(window);
