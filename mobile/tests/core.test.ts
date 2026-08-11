/* Test della logica pura: calcoli, timbratura, decisioni GPS, motore benessere.
   Girano in Node senza emulatore, perché i moduli di core non dipendono da React
   né dalle API native. */

import * as C from '../src/core/calc';
import * as P from '../src/core/punch';
import * as G from '../src/core/geofence';
import * as Coach from '../src/core/coach';
import { AppData, DEFAULT_SETTINGS, Settings, Shift } from '../src/core/types';

let passati = 0;
const falliti: string[] = [];

function ok(nome: string, ottenuto: unknown, atteso: unknown) {
  const a = JSON.stringify(ottenuto);
  const b = JSON.stringify(atteso);
  if (a === b) { passati++; console.log('  ok  ' + nome); }
  else { falliti.push(nome); console.log(' FAIL ' + nome + `\n        ottenuto=${a}\n        atteso  =${b}`); }
}

const S = (patch: Partial<Settings> = {}): Settings =>
  C.deriveOrario({ ...DEFAULT_SETTINGS, ...patch, orario: { ...DEFAULT_SETTINGS.orario, ...(patch.orario || {}) } });

const dati = (patch: Partial<AppData> = {}): AppData => ({
  settings: S(), shifts: [], checkins: [], punch: null, ...patch,
});

const turno = (p: Partial<Shift>): Shift => ({
  id: 'x', date: '2026-08-03', start: '09:00', end: '18:00',
  breakMin: 60, tipo: 'lavoro', note: '', ...p,
});

/* ---------------- orario standard ---------------- */

ok('orario 9-18 con pausa 13-14 -> 8h', [S().oreGiornaliere, S().pausaPredefinita], [8, 60]);
ok('orario 8-17 con pausa 30m -> 8,5h',
  S({ orario: { inizio: '08:00', pausaInizio: '12:30', pausaFine: '13:00', fine: '17:00' } }).oreGiornaliere, 8.5);
ok('senza pausa -> presenza piena',
  [S({ orario: { inizio: '09:00', pausaInizio: '', pausaFine: '', fine: '15:00' } }).oreGiornaliere,
   S({ orario: { inizio: '09:00', pausaInizio: '', pausaFine: '', fine: '15:00' } }).pausaPredefinita], [6, 0]);
ok('pausa retribuita -> conta come lavoro',
  S({ pausaRetribuita: true }).oreGiornaliere, 9);
ok('turno che scavalca la mezzanotte nell\'orario standard',
  S({ orario: { inizio: '22:00', pausaInizio: '', pausaFine: '', fine: '06:00' } }).oreGiornaliere, 8);

/* ---------------- durate ---------------- */

ok('9-18 con 60m di pausa', C.shiftMinutes(turno({}), S()), 480);
ok('turno notturno 22-06 con 30m', C.shiftMinutes(turno({ start: '22:00', end: '06:00', breakMin: 30 }), S()), 450);
ok('ferie non producono ore', C.shiftMinutes(turno({ tipo: 'ferie', start: '', end: '' }), S()), 0);

// Turno lasciato a metà: si può registrare, ma non inventiamo l'orario che manca.
ok('solo entrata: zero ore', C.shiftMinutes(turno({ end: '' }), S()), 0);
ok('solo uscita: zero ore', C.shiftMinutes(turno({ start: '' }), S()), 0);
ok('solo entrata è incompleto', C.turnoIncompleto(turno({ end: '' })), true);
ok('solo uscita è incompleto', C.turnoIncompleto(turno({ start: '' })), true);
ok('turno intero non è incompleto', C.turnoIncompleto(turno({})), false);
ok('turno vuoto non è incompleto', C.turnoIncompleto(turno({ start: '', end: '' })), false);
ok('le ferie non sono mai incomplete', C.turnoIncompleto(turno({ tipo: 'ferie', start: '', end: '' })), false);
ok('formato durata', [C.fmtDuration(495), C.fmtDuration(60), C.fmtDuration(-90)], ['8h 15m', '1h', '−1h 30m']);
ok('orologio', C.fmtClock(3725), '1:02:05');

/* ---------------- giornata e periodo ---------------- */

const lun = '2026-08-03', sab = '2026-08-08';
let d = C.daySummary(lun, [turno({ id: 'a', date: lun, end: '19:00' })], S());
ok('straordinario giornaliero', [d.worked, d.target, d.overtime], [540, 480, 60]);

d = C.daySummary(sab, [turno({ id: 'b', date: sab, start: '09:00', end: '13:00', breakMin: 0 })], S());
ok('sabato: tutto straordinario', [d.target, d.overtime], [0, 240]);

d = C.daySummary(lun, [
  turno({ id: 'c', date: lun, start: '09:00', end: '13:00', breakMin: 0 }),
  turno({ id: 'e', date: lun, tipo: 'permesso', start: '', end: '', breakMin: 0 }),
], S());
ok('lavoro + permesso = 100%, senza doppi conteggi', [d.worked, d.absence, Math.round(d.pct)], [240, 240, 100]);

d = C.daySummary(lun, [
  turno({ id: 'f', date: lun, tipo: 'ferie', start: '', end: '', breakMin: 0 }),
  turno({ id: 'g', date: lun, tipo: 'ferie', start: '', end: '', breakMin: 0 }),
], S());
ok('ferie duplicate non raddoppiano', Math.round(d.pct), 100);

const settimana = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
  .map((dt, i) => turno({ id: 'w' + i, date: dt }));
const w = C.rangeSummary('2026-08-03', '2026-08-09', settimana, S());
ok('settimana piena = 100%', [w.worked, w.target, Math.round(w.pct), w.overtime], [2400, 2400, 100, 0]);

const m = C.rangeSummary(C.monthStart('2026-08-10'), C.monthEnd('2026-08-10'), settimana, S(), { targetOverrideMinutes: 168 * 60 });
ok('monte ore mensile fisso', m.target, 10080);

ok('inizio settimana lunedì', C.weekStart('2026-08-06', 1), '2026-08-03');
ok('mese precedente dal 31 marzo', C.addMonths('2026-03-31', -1), '2026-02-28');
ok('paga straordinari', Math.round(C.overtimePay(120, S({ pagaOraria: 15 })) * 100) / 100, 37.5);

/* ---------------- timbratura ---------------- */

const ora = new Date('2026-08-03T18:05:00').getTime();
let stato = dati();
stato = P.startPunch(stato, ora - (9 * 3600 + 5 * 60) * 1000);
ok('timbratura aperta', !!stato.punch, true);

stato.punch!.pauses = [{ from: ora - 5 * 3600000, to: ora - 4 * 3600000 }];
const t = C.punchTotals(stato.punch!, ora);
ok('presenza, pausa e lavoro', [t.presenza, t.pausa, t.lavoro, t.inPausa], [545, 60, 485, false]);

let res = P.stopPunch(stato, ora);
ok('turno generato', [res.shift!.breakMin, C.fmtDuration(C.shiftMinutes(res.shift!, S()))], [60, '8h 05m']);
ok('timbratura chiusa', res.data.punch, null);
ok('straordinario dal turno timbrato',
  C.daySummary(res.shift!.date, res.data.shifts, S()).overtime, 5);

// pausa lasciata aperta: si chiude da sola all'uscita
stato = P.startPunch(dati(), ora - 4 * 3600000);
stato = P.toggleBreak(stato, ora - 1800000);
ok('in pausa', C.punchTotals(stato.punch!, ora).inPausa, true);
ok('pausa chiusa all\'uscita', P.stopPunch(stato, ora).shift!.breakMin, 30);

// arrotondamento
stato = dati({ settings: S({ arrotondamento: 15 }) });
const a1 = new Date('2026-08-03T09:07:00').getTime();
const b1 = new Date('2026-08-03T17:52:00').getTime();
stato = P.startPunch(stato, a1);
const arr = P.stopPunch(stato, b1).shift!;
ok('arrotondamento a 15 minuti', [arr.start, arr.end], ['09:00', '17:45']);

/* ---------------- decisioni GPS ---------------- */

const conOrario = (pausaAdesso: boolean, base: AppData): AppData => {
  const n = new Date();
  const min = n.getHours() * 60 + n.getMinutes();
  const p0 = pausaAdesso ? min - 10 : min - 400;
  const hhmm = (x: number) => {
    const v = ((x % 1440) + 1440) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  };
  return { ...base, settings: S({ orario: { inizio: '09:00', pausaInizio: hhmm(p0), pausaFine: hhmm(p0 + 60), fine: '18:00' } }) };
};

let g = conOrario(false, dati());
let e = G.decidi('enter', g);
ok('arrivo -> entrata automatica', [e.azione, !!e.data.punch], ['entrata', true]);

g = conOrario(true, e.data);
e = G.decidi('exit', g);
ok('uscita a pranzo -> pausa', [e.azione, C.punchTotals(e.data.punch!).inPausa], ['inizio-pausa', true]);

e = G.decidi('enter', e.data);
ok('rientro -> fine pausa', [e.azione, C.punchTotals(e.data.punch!).inPausa], ['fine-pausa', false]);

g = conOrario(false, e.data);
e = G.decidi('exit', g);
ok('uscita fuori pranzo -> turno chiuso', [e.azione, e.data.punch, e.data.shifts.length], ['uscita', null, 1]);

// automatismi disattivati
g = conOrario(false, dati());
g = { ...g, settings: S({ geo: { ...DEFAULT_SETTINGS.geo, autoEntrata: false } }) };
ok('senza entrata automatica -> solo promemoria', G.decidi('enter', g).azione, 'promemoria-entrata');

g = conOrario(false, P.startPunch(dati(), Date.now() - 3600000));
g = { ...g, settings: S({ geo: { ...DEFAULT_SETTINGS.geo, autoUscita: false, pausaAuto: false } }) };
const senzaUscita = G.decidi('exit', g);
ok('senza uscita automatica -> timbratura resta aperta',
  [senzaUscita.azione, !!senzaUscita.data.punch], ['promemoria-uscita', true]);

// già in pausa: una seconda uscita non deve fare nulla
g = conOrario(true, P.toggleBreak(P.startPunch(dati(), Date.now() - 3600000)));
ok('uscita mentre si è già in pausa non cambia nulla', G.decidi('exit', g).azione, null);

ok('distanza in metri', G.distanza(45.4642, 9.19, 45.4669, 9.19), 300);
ok('formato distanza', [G.fmtDist(450), G.fmtDist(1500)], ['450 m', '1,5 km']);

/* ---------------- benessere ---------------- */

const oggiISO = C.today();
const pesanti: Shift[] = [];
for (let i = 27; i >= 0; i--) {
  pesanti.push(turno({ id: 'h' + i, date: C.addDays(oggiISO, -i), start: '08:00', end: '20:00', breakMin: 0 }));
}
const met = Coach.workMetrics(pesanti, S());
ok('28 giorni da 12h: serie e pause rilevate', [met.streakMax, met.giorniSenzaPausa], [28, 28]);
ok('rischio oggettivo alto', (Coach.objectiveRisk(met).score ?? 0) >= 70, true);

const evPesante = Coach.evaluate(null, pesanti, S());
ok('livello elevato o critico', ['elevato', 'critico'].includes(evPesante.level.key), true);
ok('consigli generati', evPesante.advice.length > 0, true);

const leggeri: Shift[] = [];
for (let i = 27; i >= 0; i--) {
  const dt = C.addDays(oggiISO, -i);
  if ([0, 6].includes(C.dow(dt))) continue;
  leggeri.push(turno({ id: 'l' + i, date: dt }));
}
ok('profilo regolare -> rischio basso', Coach.evaluate(null, leggeri, S()).level.key, 'basso');

// Le domande invertite vanno risposte al contrario per rappresentare il caso peggiore.
const peggiori = Coach.scoreAnswers(Object.fromEntries(Coach.QUESTIONS.map(q => [q.id, q.invert ? 0 : 4])));
ok('tutte le risposte peggiori -> 100', peggiori.score, 100);
const neutre = Coach.scoreAnswers(Object.fromEntries(Coach.QUESTIONS.map(q => [q.id, 2])));
ok('risposte tutte intermedie -> 50', neutre.score, 50);
const parziale = Coach.scoreAnswers({ q1: 4, q2: 4 });
ok('questionario parziale: solo le aree risposte', [parziale.answered, parziale.dims.esaurimento, parziale.dims.sonno], [2, 100, null]);
const migliori = Coach.scoreAnswers(Object.fromEntries(Coach.QUESTIONS.map(q => [q.id, q.invert ? 4 : 0])));
ok('tutte le risposte migliori -> 0', migliori.score, 0);

/* ---------------- esito ---------------- */

console.log(`\n${passati}/${passati + falliti.length} test superati`);
if (falliti.length) {
  console.log('Falliti: ' + falliti.join(', '));
  process.exit(1);
}
