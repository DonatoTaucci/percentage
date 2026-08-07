/* punch.ts — operazioni sulla timbratura e sui turni.
   Funzioni pure su AppData: le usa sia l'interfaccia sia il task di
   geofencing, che gira senza React quando l'app è chiusa. */

import { AppData, Punch, Shift, TipoGiornata } from './types';
import { punchTotals, timeFromMs, toISO } from './calc';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ordina(shifts: Shift[]): Shift[] {
  return [...shifts].sort((a, b) =>
    a.date === b.date ? (a.start || '').localeCompare(b.start || '') : (a.date < b.date ? -1 : 1));
}

export function saveShift(data: AppData, input: Partial<Shift> & { date: string }): { data: AppData; shift: Shift } {
  const shift: Shift = {
    id: input.id || uid(),
    date: input.date,
    start: input.start || '',
    end: input.end || '',
    breakMin: Math.max(0, Math.round(Number(input.breakMin) || 0)),
    tipo: (input.tipo || 'lavoro') as TipoGiornata,
    note: (input.note || '').slice(0, 400),
  };
  const i = data.shifts.findIndex(s => s.id === shift.id);
  const shifts = i >= 0
    ? data.shifts.map(s => (s.id === shift.id ? shift : s))
    : [...data.shifts, shift];
  return { data: { ...data, shifts: ordina(shifts) }, shift };
}

export function deleteShift(data: AppData, id: string): AppData {
  return { ...data, shifts: data.shifts.filter(s => s.id !== id) };
}

export function startPunch(data: AppData, atMs: number = Date.now()): AppData {
  if (data.punch) return data;
  const punch: Punch = { date: toISO(new Date(atMs)), startedAt: atMs, pauses: [] };
  return { ...data, punch };
}

/** Apre la pausa se chiusa, la chiude se aperta. */
export function toggleBreak(data: AppData, atMs: number = Date.now()): AppData {
  if (!data.punch) return data;
  const pauses = data.punch.pauses.map(p => ({ ...p }));
  const last = pauses[pauses.length - 1];
  if (last && last.to === null) last.to = atMs;
  else pauses.push({ from: atMs, to: null });
  return { ...data, punch: { ...data.punch, pauses } };
}

/** Chiude la timbratura e la trasforma in un turno. */
export function stopPunch(data: AppData, atMs: number = Date.now(), note = ''): { data: AppData; shift: Shift | null } {
  if (!data.punch) return { data, shift: null };

  const pauses = data.punch.pauses.map(p => ({ from: p.from, to: p.to ?? atMs }));
  const round = Math.max(1, Math.round(data.settings.arrotondamento) || 1);
  const roundMs = round * 60000;
  const startR = Math.round(data.punch.startedAt / roundMs) * roundMs;
  const endR = Math.round(atMs / roundMs) * roundMs;
  const pausaMin = pauses.reduce((acc, b) => acc + ((b.to as number) - b.from), 0) / 60000;

  const saved = saveShift(data, {
    date: data.punch.date,
    start: timeFromMs(startR),
    end: timeFromMs(endR),
    breakMin: Math.round(pausaMin / round) * round,
    tipo: 'lavoro',
    note,
  });

  return { data: { ...saved.data, punch: null }, shift: saved.shift };
}

export function cancelPunch(data: AppData): AppData {
  return { ...data, punch: null };
}

export function isInPausa(data: AppData, nowMs = Date.now()): boolean {
  return data.punch ? punchTotals(data.punch, nowMs).inPausa : false;
}
