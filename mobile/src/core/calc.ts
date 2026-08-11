/* calc.ts — date, durate, percentuali, straordinari.
   Modulo puro: nessuna dipendenza da React o dalle API native,
   così è usabile anche dal task di geofencing in background. */

import { Settings, Shift, Punch, TIPI } from './types';

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

const MS_DAY = 86400000;

/* ---------- date ---------- */

export function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function toISO(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function fromISO(iso: string): Date {
  const p = iso.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}

export function today(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function dow(iso: string): number {
  return fromISO(iso).getDay();
}

export function weekStart(iso: string, firstDay = 1): string {
  const d = fromISO(iso);
  const diff = (d.getDay() - firstDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
}

export function weekEnd(iso: string, firstDay = 1): string {
  return addDays(weekStart(iso, firstDay), 6);
}

export function monthStart(iso: string): string {
  return iso.slice(0, 8) + '01';
}

export function monthEnd(iso: string): string {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 4000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function isoWeekNumber(iso: string): number {
  const d = fromISO(iso);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * MS_DAY));
}

/* ---------- formattazione ---------- */

export function fmtDate(iso: string, style?: 'long' | 'medium'): string {
  const d = fromISO(iso);
  if (style === 'long') return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
  if (style === 'medium') return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  return `${d.getDate()}/${pad(d.getMonth() + 1)}`;
}

export function fmtMonth(iso: string): string {
  const d = fromISO(iso);
  return `${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDuration(minutes: number): string {
  const neg = minutes < 0;
  const m = Math.round(Math.abs(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const s = h > 0 ? h + 'h' + (r ? ' ' + pad(r) + 'm' : '') : r + 'm';
  return (neg ? '−' : '') + s;
}

export function fmtHours(minutes: number, dec = 1): string {
  return (minutes / 60).toFixed(dec).replace('.', ',') + ' h';
}

export function fmtPct(v: number): string {
  if (!isFinite(v)) return '—';
  return String(Math.round(v * 10) / 10).replace('.', ',') + '%';
}

export function fmtMoney(v: number, settings: Settings): string {
  return (settings.valuta || '€') + ' ' + v.toFixed(2).replace('.', ',');
}

export function parseTime(hhmm: string): number | null {
  if (!hhmm || hhmm.indexOf(':') < 0) return null;
  const p = hhmm.split(':');
  const h = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function timeFromMs(ms: number): string {
  const d = new Date(ms);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/* Minuti fra due orari HH:MM, gestendo il passaggio di mezzanotte. */
export function diffMin(a: string, b: string): number {
  const pa = parseTime(a) ?? 0;
  const pb = parseTime(b) ?? 0;
  let d = pb - pa;
  if (d < 0) d += 24 * 60;
  return d;
}

/* ---------- durate turno ---------- */

export function shiftMinutes(shift: Pick<Shift, 'start' | 'end' | 'breakMin' | 'tipo'>, settings: Settings): number {
  const def = TIPI[shift.tipo] ?? TIPI.lavoro;
  if (def.conteggia !== 'ore') return 0;
  const a = parseTime(shift.start);
  const b = parseTime(shift.end);
  if (a === null || b === null) return 0;
  let dur = b - a;
  if (dur < 0) dur += 24 * 60;                 // turno notturno
  const pausa = settings.pausaRetribuita ? 0 : (shift.breakMin || 0);
  return Math.max(0, dur - pausa);
}

/* Turno a ore con un solo orario: manca l'entrata o l'uscita.

   Vale zero minuti, perché l'orario mancante non lo inventiamo: dedurlo
   dall'orario standard falserebbe proprio le percentuali per cui esiste
   questa applicazione. Va però distinto da una giornata non lavorata. */
export function turnoIncompleto(shift: Pick<Shift, 'start' | 'end' | 'tipo'>): boolean {
  const def = TIPI[shift.tipo] ?? TIPI.lavoro;
  if (def.conteggia !== 'ore') return false;
  const a = parseTime(shift.start);
  const b = parseTime(shift.end);
  return (a === null) !== (b === null);
}

export function shiftSpanMinutes(shift: Pick<Shift, 'start' | 'end'>): number {
  const a = parseTime(shift.start);
  const b = parseTime(shift.end);
  if (a === null || b === null) return 0;
  let dur = b - a;
  if (dur < 0) dur += 24 * 60;
  return dur;
}

export function isNightShift(shift: Pick<Shift, 'start' | 'end'>): boolean {
  const a = parseTime(shift.start);
  const b = parseTime(shift.end);
  if (a === null || b === null) return false;
  return b < a || a >= 21 * 60 || a < 6 * 60 || b > 22 * 60;
}

/* ---------- ore contrattuali derivate dall'orario standard ---------- */

export function deriveOrario(settings: Settings): Settings {
  const o = settings.orario;
  const pausa = (o.pausaInizio && o.pausaFine) ? diffMin(o.pausaInizio, o.pausaFine) : 0;
  const presenza = diffMin(o.inizio, o.fine);
  return {
    ...settings,
    pausaPredefinita: pausa,
    oreGiornaliere: Math.max(0, presenza - (settings.pausaRetribuita ? 0 : pausa)) / 60,
  };
}

export function dailyTargetMinutes(iso: string, settings: Settings): number {
  return settings.giorniLavorativi.includes(dow(iso)) ? Math.round(settings.oreGiornaliere * 60) : 0;
}

/* ---------- aggregazione ---------- */

export type DaySummary = {
  date: string;
  entries: Shift[];
  worked: number;
  span: number;
  pausa: number;
  absence: number;
  credited: number;
  target: number;
  overtime: number;
  deficit: number;
  pct: number;
  isWorkday: boolean;
};

export function daySummary(iso: string, shifts: Shift[], settings: Settings): DaySummary {
  const list = shifts.filter(s => s.date === iso);
  const target = dailyTargetMinutes(iso, settings);

  let worked = 0, span = 0, pausa = 0, haAssenza = false;
  for (const s of list) {
    const def = TIPI[s.tipo] ?? TIPI.lavoro;
    if (def.conteggia === 'ore') {
      worked += shiftMinutes(s, settings);
      span += shiftSpanMinutes(s);
      pausa += settings.pausaRetribuita ? 0 : (s.breakMin || 0);
    } else if (def.conteggia === 'target') {
      haAssenza = true;
    }
  }

  // Un'assenza retribuita copre solo la parte di giornata non lavorata.
  const base = target > 0 ? target : Math.round(settings.oreGiornaliere * 60);
  const absence = haAssenza ? Math.max(0, base - worked) : 0;
  const credited = worked + absence;

  const soglia = Math.round((settings.sogliaStraordinario || settings.oreGiornaliere) * 60);
  const overtime = target === 0 ? worked : Math.max(0, worked - soglia);

  return {
    date: iso,
    entries: list,
    worked, span, pausa, absence, credited, target, overtime,
    deficit: Math.max(0, target - credited),
    pct: target > 0 ? (credited / target) * 100 : (worked > 0 ? 100 : 0),
    isWorkday: target > 0,
  };
}

export type RangeSummary = {
  from: string;
  to: string;
  days: DaySummary[];
  worked: number; credited: number; target: number; overtime: number; absence: number;
  pausa: number; span: number;
  workedDays: number; absenceDays: number; restDays: number; nightDays: number;
  longDays: number; noBreakDays: number;
  deficit: number; pct: number; saldo: number; mediaGiorno: number;
  inCorso: boolean; targetToDate: number; creditedToDate: number;
  pctToDate: number; saldoToDate: number;
  live?: boolean;
};

export function rangeSummary(
  from: string, to: string, shifts: Shift[], settings: Settings,
  opts: { targetOverrideMinutes?: number } = {}
): RangeSummary {
  const days = daysBetween(from, to).map(iso => daySummary(iso, shifts, settings));

  const tot = {
    worked: 0, credited: 0, target: 0, overtime: 0, absence: 0, pausa: 0, span: 0,
    workedDays: 0, absenceDays: 0, restDays: 0, nightDays: 0, longDays: 0, noBreakDays: 0,
  };

  for (const d of days) {
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
  }

  // Previsto maturato a oggi: per un periodo in corso è il confronto sensato.
  const oggi = today();
  const targetGrezzo = tot.target;
  let targetFinora = 0, creditedFinora = 0;
  for (const d of days) {
    if (d.date <= oggi) {
      targetFinora += d.target;
      creditedFinora += d.credited;
    }
  }

  let target = tot.target;
  if (opts.targetOverrideMinutes && opts.targetOverrideMinutes > 0) {
    const quota = targetGrezzo > 0 ? targetFinora / targetGrezzo : 1;
    target = opts.targetOverrideMinutes;
    targetFinora = Math.round(opts.targetOverrideMinutes * quota);
  }

  return {
    from, to, days,
    ...tot,
    target,
    deficit: Math.max(0, target - tot.credited),
    pct: target > 0 ? (tot.credited / target) * 100 : (tot.worked > 0 ? 100 : 0),
    saldo: tot.credited - target,
    mediaGiorno: tot.workedDays > 0 ? tot.worked / tot.workedDays : 0,
    inCorso: to >= oggi && from <= oggi,
    targetToDate: targetFinora,
    creditedToDate: creditedFinora,
    pctToDate: targetFinora > 0 ? (creditedFinora / targetFinora) * 100 : (creditedFinora > 0 ? 100 : 0),
    saldoToDate: creditedFinora - targetFinora,
  };
}

export function maxStreak(days: DaySummary[]): number {
  let best = 0, cur = 0;
  for (const d of days) {
    if (d.worked > 0) { cur++; if (cur > best) best = cur; } else cur = 0;
  }
  return best;
}

export function currentStreak(days: DaySummary[]): number {
  let cur = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].worked > 0) cur++; else break;
  }
  return cur;
}

export function monthTargetMinutes(anyISO: string, settings: Settings): number {
  if (settings.oreMensiliFisse > 0) return Math.round(settings.oreMensiliFisse * 60);
  return daysBetween(monthStart(anyISO), monthEnd(anyISO))
    .reduce((acc, iso) => acc + dailyTargetMinutes(iso, settings), 0);
}

export function overtimePay(minutes: number, settings: Settings): number {
  if (!settings.pagaOraria || settings.pagaOraria <= 0) return 0;
  return (minutes / 60) * settings.pagaOraria * (1 + (settings.maggiorazione || 0) / 100);
}

/* ---------- timbratura ---------- */

export type PunchTotals = {
  inPausa: boolean;
  pausaCorrenteDa: number | null;
  startedAt: number;
  presenza: number;
  pausa: number;
  lavoro: number;
  lavoroSec: number;
  giorniFa: number;
};

export function punchTotals(punch: Punch, nowMs: number = Date.now()): PunchTotals {
  const pauses = punch.pauses || [];
  const last = pauses[pauses.length - 1];
  const inPausa = !!(last && last.to === null);

  const pausaMs = pauses.reduce((acc, b) => acc + ((b.to ?? nowMs) - b.from), 0);
  const totMs = Math.max(0, nowMs - punch.startedAt);
  const lavoroMs = Math.max(0, totMs - pausaMs);

  return {
    inPausa,
    pausaCorrenteDa: inPausa ? last.from : null,
    startedAt: punch.startedAt,
    presenza: Math.floor(totMs / 60000),
    pausa: Math.floor(pausaMs / 60000),
    lavoro: Math.floor(lavoroMs / 60000),
    lavoroSec: Math.floor(lavoroMs / 1000),
    giorniFa: Math.floor((nowMs - punch.startedAt) / MS_DAY),
  };
}

/** Ora di uscita stimata per completare le ore previste. */
export function expectedEnd(punch: Punch, settings: Settings, targetMin: number, nowMs = Date.now()): number {
  const t = punchTotals(punch, nowMs);
  const pausaPrevista = settings.pausaRetribuita ? 0 : Math.max(t.pausa, settings.pausaPredefinita || 0);
  return punch.startedAt + (targetMin + pausaPrevista) * 60000;
}

export function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${pad(m)}:${pad(sec % 60)}`;
}
