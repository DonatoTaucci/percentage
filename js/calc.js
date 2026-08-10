/* calc.js — date, durate, percentuali, straordinari. */
(function (global) {
  'use strict';

  var MS_DAY = 86400000;

  /* Nomi di mesi e giorni: li chiediamo al browser invece di elencarli.
     Un dizionario di traduzione qui sarebbe sbagliato due volte — l'iniziale
     di "martedì" e "mercoledì" è la stessa lettera, quindi una singola voce
     "M" non potrebbe rendere entrambe — e comunque ogni lingua ha le proprie
     abbreviazioni, che Intl conosce già. */
  var GENNAIO_2024 = Date.UTC(2024, 0, 1);   // un lunedì, comodo per i giorni

  function nomi(tipo, formato) {
    var lingua = (global.I18n && global.I18n.lingua()) || 'it';
    var fmt = new Intl.DateTimeFormat(lingua, tipo === 'mese'
      ? { month: formato, timeZone: 'UTC' }
      : { weekday: formato, timeZone: 'UTC' });
    var out = [];
    if (tipo === 'mese') {
      for (var m = 0; m < 12; m++) out.push(fmt.format(new Date(Date.UTC(2024, m, 1))));
    } else {
      // indice 0 = domenica, come getDay()
      for (var g = 0; g < 7; g++) out.push(fmt.format(new Date(GENNAIO_2024 + (g - 1) * MS_DAY)));
    }
    return out;
  }

  // Ricalcolati a ogni chiamata: la lingua può cambiare ad app aperta.
  function mesi() { return nomi('mese', 'long'); }
  function mesiBrevi() { return nomi('mese', 'short'); }
  function giorni() { return nomi('giorno', 'long'); }
  function giorniBrevi() { return nomi('giorno', 'short'); }

  var TIPI = {
    lavoro:   { label: 'Lavoro',    conteggia: 'ore' },
    ferie:    { label: 'Ferie',     conteggia: 'target' },
    permesso: { label: 'Permesso',  conteggia: 'target' },
    malattia: { label: 'Malattia',  conteggia: 'target' },
    festivo:  { label: 'Festività', conteggia: 'target' },
    riposo:   { label: 'Riposo',    conteggia: 'nulla' }
  };

  /* ---------- date ---------- */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fromISO(iso) {
    var p = iso.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function today() { return toISO(new Date()); }

  function addDays(iso, n) {
    var d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  function dow(iso) { return fromISO(iso).getDay(); }

  // Inizio settimana (lunedì per default).
  function weekStart(iso, firstDay) {
    var first = typeof firstDay === 'number' ? firstDay : 1;
    var d = fromISO(iso);
    var diff = (d.getDay() - first + 7) % 7;
    d.setDate(d.getDate() - diff);
    return toISO(d);
  }

  function weekEnd(iso, firstDay) { return addDays(weekStart(iso, firstDay), 6); }

  function monthStart(iso) { return iso.slice(0, 8) + '01'; }

  function monthEnd(iso) {
    var d = fromISO(iso);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return toISO(last);
  }

  function addMonths(iso, n) {
    var d = fromISO(iso);
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return toISO(d);
  }

  function daysBetween(fromISOs, toISOs) {
    var out = [];
    var cur = fromISOs;
    var guard = 0;
    while (cur <= toISOs && guard++ < 4000) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }

  function isoWeekNumber(iso) {
    var d = fromISO(iso);
    var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dayNr = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    var firstThursday = new Date(target.getFullYear(), 0, 4);
    var firstDayNr = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
    return 1 + Math.round((target - firstThursday) / (7 * MS_DAY));
  }

  /* ---------- formattazione ---------- */

  function fmtDate(iso, style) {
    var d = fromISO(iso);
    if (style === 'long') return giorni()[d.getDay()] + ' ' + d.getDate() + ' ' + mesi()[d.getMonth()] + ' ' + d.getFullYear();
    if (style === 'medium') return giorniBrevi()[d.getDay()] + ' ' + d.getDate() + ' ' + mesiBrevi()[d.getMonth()];
    return d.getDate() + '/' + pad(d.getMonth() + 1);
  }

  function fmtMonth(iso) {
    var d = fromISO(iso);
    return mesi()[d.getMonth()] + ' ' + d.getFullYear();
  }

  // 495 -> "8h 15m"
  function fmtDuration(minutes) {
    var neg = minutes < 0;
    var m = Math.round(Math.abs(minutes));
    var h = Math.floor(m / 60);
    var r = m % 60;
    var s = h > 0 ? h + 'h' + (r ? ' ' + pad(r) + 'm' : '') : r + 'm';
    return (neg ? '−' : '') + s;
  }

  function fmtHours(minutes, dec) {
    return (minutes / 60).toFixed(typeof dec === 'number' ? dec : 1).replace('.', ',') + ' h';
  }

  function fmtPct(v) {
    if (!isFinite(v)) return '—';
    return (Math.round(v * 10) / 10).toString().replace('.', ',') + '%';
  }

  function parseTime(hhmm) {
    if (!hhmm || hhmm.indexOf(':') < 0) return null;
    var p = hhmm.split(':');
    var h = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  /* ---------- durate turno ---------- */

  // Minuti effettivamente lavorati in un turno (gestisce i turni a cavallo di mezzanotte).
  function shiftMinutes(shift, settings) {
    if (!shift || TIPI[shift.tipo] && TIPI[shift.tipo].conteggia !== 'ore') return 0;
    var a = parseTime(shift.start);
    var b = parseTime(shift.end);
    if (a === null || b === null) return 0;
    var dur = b - a;
    if (dur < 0) dur += 24 * 60;           // turno notturno
    var pausa = settings && settings.pausaRetribuita ? 0 : (shift.breakMin || 0);
    return Math.max(0, dur - pausa);
  }

  // Durata lorda (pausa inclusa) = tempo di presenza.
  function shiftSpanMinutes(shift) {
    var a = parseTime(shift.start);
    var b = parseTime(shift.end);
    if (a === null || b === null) return 0;
    var dur = b - a;
    if (dur < 0) dur += 24 * 60;
    return dur;
  }

  function isNightShift(shift) {
    var a = parseTime(shift.start);
    var b = parseTime(shift.end);
    if (a === null || b === null) return false;
    return b < a || a >= 21 * 60 || a < 6 * 60 || b > 22 * 60;
  }

  /* ---------- timbratura ---------- */

  function timeFromMs(ms) {
    var d = new Date(ms);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** Stato calcolato di una timbratura in corso (o appena chiusa). */
  function punchTotals(punch, nowMs) {
    if (!punch) return null;
    var now = nowMs || Date.now();
    var pauses = punch.pauses || [];
    var last = pauses[pauses.length - 1];
    var inPausa = !!(last && !last.to);

    var pausaMs = pauses.reduce(function (acc, b) {
      return acc + ((b.to || now) - b.from);
    }, 0);
    var totMs = Math.max(0, now - punch.startedAt);
    var lavoroMs = Math.max(0, totMs - pausaMs);

    return {
      inPausa: inPausa,
      pausaCorrenteDa: inPausa ? last.from : null,
      startedAt: punch.startedAt,
      presenza: Math.floor(totMs / 60000),
      pausa: Math.floor(pausaMs / 60000),
      lavoro: Math.floor(lavoroMs / 60000),
      lavoroSec: Math.floor(lavoroMs / 1000),
      giorniFa: Math.floor((now - punch.startedAt) / 86400000)
    };
  }

  /** Ora di uscita per completare le ore previste, dati start e pause. */
  function expectedEnd(punch, settings, targetMin, nowMs) {
    var t = punchTotals(punch, nowMs);
    if (!t) return null;
    var pausaPrevista = settings.pausaRetribuita ? 0 : Math.max(t.pausa, settings.pausaPredefinita || 0);
    return punch.startedAt + (targetMin + pausaPrevista) * 60000;
  }

  /* ---------- target ---------- */

  function dailyTargetMinutes(iso, settings) {
    var giorni = settings.giorniLavorativi || [];
    return giorni.indexOf(dow(iso)) >= 0 ? Math.round(settings.oreGiornaliere * 60) : 0;
  }

  /* ---------- aggregazione ---------- */

  /**
   * Riepilogo di un singolo giorno.
   * worked      = minuti effettivamente lavorati
   * credited    = minuti riconosciuti (lavoro + assenze retribuite)
   * target      = minuti previsti dal contratto
   * overtime    = minuti oltre la soglia giornaliera
   */
  function daySummary(iso, shifts, settings) {
    var list = shifts.filter(function (s) { return s.date === iso; });
    var target = dailyTargetMinutes(iso, settings);
    var worked = 0;
    var span = 0;
    var pausa = 0;
    var tipi = [];
    var haAssenza = false;

    list.forEach(function (s) {
      var def = TIPI[s.tipo] || TIPI.lavoro;
      tipi.push(s.tipo);
      if (def.conteggia === 'ore') {
        worked += shiftMinutes(s, settings);
        span += shiftSpanMinutes(s);
        pausa += settings.pausaRetribuita ? 0 : (s.breakMin || 0);
      } else if (def.conteggia === 'target') {
        haAssenza = true;
      }
    });

    // Un'assenza retribuita copre solo la parte di giornata non lavorata,
    // e non si somma più volte se ci sono più voci nello stesso giorno.
    var base = target > 0 ? target : Math.round(settings.oreGiornaliere * 60);
    var absence = haAssenza ? Math.max(0, base - worked) : 0;

    var credited = worked + absence;
    var soglia = Math.round((settings.sogliaStraordinario || settings.oreGiornaliere) * 60);
    var overtime;
    if (target === 0) {
      overtime = worked;                       // lavoro in giorno non previsto
    } else {
      overtime = Math.max(0, worked - soglia);
    }

    return {
      date: iso,
      entries: list,
      tipi: tipi,
      worked: worked,
      span: span,
      pausa: pausa,
      absence: absence,
      credited: credited,
      target: target,
      overtime: overtime,
      deficit: Math.max(0, target - credited),
      pct: target > 0 ? (credited / target) * 100 : (worked > 0 ? 100 : 0),
      isWorkday: target > 0,
      hasWork: worked > 0
    };
  }

  /** Riepilogo su un intervallo di date (estremi inclusi). */
  function rangeSummary(fromISOs, toISOs, shifts, settings, opts) {
    opts = opts || {};
    var days = daysBetween(fromISOs, toISOs).map(function (iso) {
      return daySummary(iso, shifts, settings);
    });

    var tot = {
      from: fromISOs,
      to: toISOs,
      days: days,
      worked: 0, credited: 0, target: 0, overtime: 0, absence: 0,
      pausa: 0, span: 0,
      workedDays: 0, absenceDays: 0, restDays: 0, nightDays: 0,
      longDays: 0, noBreakDays: 0
    };

    days.forEach(function (d) {
      tot.worked += d.worked;
      tot.credited += d.credited;
      tot.target += d.target;
      tot.overtime += d.overtime;
      tot.absence += d.absence;
      tot.pausa += d.pausa;
      tot.span += d.span;
      if (d.worked > 0) {
        tot.workedDays++;
        if (d.worked >= 10 * 60) tot.longDays++;
        if (d.pausa === 0 && d.worked >= 6 * 60) tot.noBreakDays++;
        if (d.entries.some(isNightShift)) tot.nightDays++;
      } else if (d.absence > 0) {
        tot.absenceDays++;
      } else if (!d.isWorkday) {
        tot.restDays++;
      }
    });

    // Previsto maturato fino a oggi: per un periodo in corso è il confronto
    // sensato (a inizio mese il monte ore dell'intero mese non dice nulla).
    var oggi = today();
    var targetGrezzo = tot.target;
    var targetFinora = 0, creditedFinora = 0;
    days.forEach(function (d) {
      if (d.date <= oggi) {
        targetFinora += d.target;
        creditedFinora += d.credited;
      }
    });

    if (opts.targetOverrideMinutes > 0) {
      var quota = targetGrezzo > 0 ? targetFinora / targetGrezzo : 1;
      tot.target = opts.targetOverrideMinutes;
      targetFinora = Math.round(opts.targetOverrideMinutes * quota);
    }

    tot.deficit = Math.max(0, tot.target - tot.credited);
    tot.pct = tot.target > 0 ? (tot.credited / tot.target) * 100 : (tot.worked > 0 ? 100 : 0);
    tot.pctSoloLavoro = tot.target > 0 ? (tot.worked / tot.target) * 100 : 0;
    tot.saldo = tot.credited - tot.target;
    tot.mediaGiorno = tot.workedDays > 0 ? tot.worked / tot.workedDays : 0;

    tot.inCorso = toISOs >= oggi && fromISOs <= oggi;
    tot.targetToDate = targetFinora;
    tot.creditedToDate = creditedFinora;
    tot.pctToDate = targetFinora > 0 ? (creditedFinora / targetFinora) * 100 : (creditedFinora > 0 ? 100 : 0);
    tot.saldoToDate = creditedFinora - targetFinora;

    return tot;
  }

  /** Massimo numero di giorni lavorati consecutivi nell'intervallo. */
  function maxStreak(days) {
    var best = 0, cur = 0;
    days.forEach(function (d) {
      if (d.worked > 0) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    });
    return best;
  }

  /** Giorni consecutivi lavorati che terminano all'ultima data dell'intervallo. */
  function currentStreak(days) {
    var cur = 0;
    for (var i = days.length - 1; i >= 0; i--) {
      if (days[i].worked > 0) cur++;
      else break;
    }
    return cur;
  }

  function monthTargetMinutes(anyISO, settings) {
    if (settings.oreMensiliFisse > 0) return Math.round(settings.oreMensiliFisse * 60);
    var days = daysBetween(monthStart(anyISO), monthEnd(anyISO));
    return days.reduce(function (acc, iso) { return acc + dailyTargetMinutes(iso, settings); }, 0);
  }

  function overtimePay(minutes, settings) {
    if (!settings.pagaOraria || settings.pagaOraria <= 0) return 0;
    var mult = 1 + (settings.maggiorazione || 0) / 100;
    return (minutes / 60) * settings.pagaOraria * mult;
  }

  function fmtMoney(v, settings) {
    return (settings.valuta || '€') + ' ' + v.toFixed(2).replace('.', ',');
  }

  global.Calc = {
    get MESI() { return mesi(); },
    get MESI_BREVI() { return mesiBrevi(); },
    get GIORNI() { return giorni(); },
    get GIORNI_BREVI() { return giorniBrevi(); },
    TIPI: TIPI,
    pad: pad, toISO: toISO, fromISO: fromISO, today: today, addDays: addDays, dow: dow,
    weekStart: weekStart, weekEnd: weekEnd, monthStart: monthStart, monthEnd: monthEnd,
    addMonths: addMonths, daysBetween: daysBetween, isoWeekNumber: isoWeekNumber,
    fmtDate: fmtDate, fmtMonth: fmtMonth, fmtDuration: fmtDuration, fmtHours: fmtHours,
    fmtPct: fmtPct, fmtMoney: fmtMoney, parseTime: parseTime,
    timeFromMs: timeFromMs, punchTotals: punchTotals, expectedEnd: expectedEnd,
    shiftMinutes: shiftMinutes, shiftSpanMinutes: shiftSpanMinutes, isNightShift: isNightShift,
    dailyTargetMinutes: dailyTargetMinutes, daySummary: daySummary, rangeSummary: rangeSummary,
    maxStreak: maxStreak, currentStreak: currentStreak, monthTargetMinutes: monthTargetMinutes,
    overtimePay: overtimePay
  };
})(window);
