// Test della timbratura (badge) e della logica GPS.
// Uso: python3 -m http.server 8765 &  →  node tests/timbratura.test.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 900 },
    permissions: ['geolocation'],
    geolocation: { latitude: 45.4750, longitude: 9.19 },
    locale: 'it-IT'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const BASE = process.env.BASE_URL || 'http://localhost:8765';
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });

  const res = await page.evaluate(() => {
    const log = [];
    const ok = (n, got, want) => log.push({ n, got, want, pass: JSON.stringify(got) === JSON.stringify(want) });

    /* ---------- timbratura ---------- */

    Store.wipe(); Store.cancelPunch();
    Store.updateSettings({ orario: { inizio: '09:00', pausaInizio: '13:00', pausaFine: '14:00', fine: '18:00' }, arrotondamento: 1 });

    const s = Store.settings();
    ok('orario standard -> 8h contrattuali', [s.oreGiornaliere, s.pausaPredefinita], [8, 60]);

    Store.updateSettings({ orario: { inizio: '08:00', pausaInizio: '12:30', pausaFine: '13:00', fine: '16:30' } });
    ok('orario ridotto -> 8h di presenza meno 30m', Store.settings().oreGiornaliere, 8);
    Store.updateSettings({ orario: { inizio: '09:00', pausaInizio: '', pausaFine: '', fine: '15:00' } });
    ok('senza pausa -> 6h', [Store.settings().oreGiornaliere, Store.settings().pausaPredefinita], [6, 0]);
    Store.updateSettings({ orario: { inizio: '09:00', pausaInizio: '13:00', pausaFine: '14:00', fine: '18:00' } });

    // entrata → pausa → rientro → uscita, con orari retrodatati
    const now = Date.now();
    Store.startPunch(now - (9 * 3600 + 5 * 60) * 1000);
    ok('timbratura aperta', !!Store.punch(), true);
    Store.punch().pauses = [{ from: now - 5 * 3600000, to: now - 4 * 3600000 }];
    const t = Calc.punchTotals(Store.punch(), now);
    ok('presenza e pausa calcolate', [t.presenza, t.pausa, t.lavoro, t.inPausa], [545, 60, 485, false]);

    const turno = Store.stopPunch(now);
    ok('turno generato dalla timbratura', [turno.breakMin, Calc.fmtDuration(Calc.shiftMinutes(turno, Store.settings()))], [60, '8h 05m']);
    ok('straordinario oltre la soglia', Calc.daySummary(turno.date, Store.shifts(), Store.settings()).overtime, 5);
    ok('timbratura chiusa', Store.punch(), null);

    // pausa lasciata aperta: si chiude all'uscita
    Store.wipe();
    Store.startPunch(now - 4 * 3600000);
    Store.toggleBreak(now - 1800000);
    ok('in pausa', Calc.punchTotals(Store.punch(), now).inPausa, true);
    const t2 = Store.stopPunch(now);
    ok('pausa chiusa in automatico', t2.breakMin, 30);

    // arrotondamento
    Store.wipe();
    Store.updateSettings({ arrotondamento: 15 });
    const a = new Date(); a.setHours(9, 7, 0, 0);
    const b = new Date(); b.setHours(17, 52, 0, 0);
    Store.startPunch(a.getTime());
    const t3 = Store.stopPunch(b.getTime());
    ok('arrotondamento a 15 minuti', [t3.start, t3.end], ['09:00', '17:45']);
    Store.updateSettings({ arrotondamento: 1 });

    /* ---------- geofence ---------- */

    const UFF = [45.4642, 9.1900], VIA = [45.4750, 9.1900];   // ~1,2 km
    const pos = (c, acc) => ({ coords: { latitude: c[0], longitude: c[1], accuracy: acc || 10 } });
    const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    const oraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

    const reset = (pausaAdesso) => {
      Store.wipe(); Store.cancelPunch();
      const m = oraMin();
      const p0 = pausaAdesso ? m - 10 : m - 400;
      Store.updateSettings({ orario: { inizio: '09:00', pausaInizio: hhmm(p0), pausaFine: hhmm(p0 + 60), fine: '18:00' } });
      Geo.set({ attivo: true, lat: UFF[0], lng: UFF[1], raggio: 150, dwell: 0,
                autoEntrata: true, autoUscita: true, pausaAuto: true, notifiche: false });
      Geo.stato.dentro = null; Geo.stato.pending = null; Geo.stato.ultimaAzione = null;
    };
    const stato = () => {
      const pu = Store.punch();
      return { punch: !!pu, inPausa: pu ? Calc.punchTotals(pu).inPausa : null,
               turni: Store.shifts().length, azione: Geo.stato.ultimaAzione && Geo.stato.ultimaAzione.tipo };
    };
    const finestraPausa = (adesso) => {
      const m = oraMin();
      const p0 = adesso ? m - 10 : m - 400;
      Store.updateSettings({ orario: Object.assign({}, Store.settings().orario, { pausaInizio: hhmm(p0), pausaFine: hhmm(p0 + 60) }) });
    };

    reset(false);
    Geo._onPosition(pos(VIA));
    ok('prima lettura non agisce', stato(), { punch: false, inPausa: null, turni: 0, azione: null });

    Geo._onPosition(pos(UFF));
    ok('arrivo -> entrata automatica', stato(), { punch: true, inPausa: false, turni: 0, azione: 'entrata' });

    finestraPausa(true);
    Geo._onPosition(pos(VIA));
    ok('uscita a pranzo -> pausa', stato(), { punch: true, inPausa: true, turni: 0, azione: 'inizio-pausa' });

    Geo._onPosition(pos(UFF));
    ok('rientro -> fine pausa', stato(), { punch: true, inPausa: false, turni: 0, azione: 'fine-pausa' });

    finestraPausa(false);
    Geo._onPosition(pos(VIA));
    const s4 = stato();
    ok('uscita fine giornata -> turno salvato', { punch: s4.punch, turni: s4.turni, azione: s4.azione },
       { punch: false, turni: 1, azione: 'uscita' });

    // isteresi: oltre il raggio ma sotto la soglia di uscita
    reset(false);
    Geo._onPosition(pos(VIA)); Geo._onPosition(pos(UFF));
    Geo._onPosition(pos([45.46575, 9.19]));       // ~172 m, raggio 150 + margine 53
    ok('isteresi: scostamento breve non chiude il turno', stato().punch, true);

    // letture imprecise non decidono
    Geo._onPosition(pos(VIA, 500));
    ok('lettura con precisione 500 m ignorata', stato().punch, true);

    // tempo di conferma
    reset(false);
    Geo._onPosition(pos(VIA)); Geo._onPosition(pos(UFF));
    Geo.set({ dwell: 60 });
    Geo._onPosition(pos(VIA));
    ok('conferma a 60 s: non agisce subito', stato().punch, true);
    Geo.stato.pending.since -= 61000;
    Geo._onPosition(pos(VIA));
    ok('conferma scaduta: agisce', stato().punch, false);

    // automatismi disattivati
    reset(false);
    Geo.set({ dwell: 0, autoUscita: false, pausaAuto: false });
    Geo._onPosition(pos(VIA)); Geo._onPosition(pos(UFF));
    Geo._onPosition(pos(VIA));
    ok('senza uscita automatica resta solo il promemoria',
       { punch: stato().punch, azione: stato().azione }, { punch: true, azione: 'promemoria-uscita' });

    ok('distanza in metri', Geo.distanza(45.4642, 9.19, 45.4669, 9.19), 300);

    return log;
  });

  res.forEach(t => console.log((t.pass ? '  ok  ' : ' FAIL ') + t.n +
    (t.pass ? '' : `\n        ottenuto=${JSON.stringify(t.got)}\n        atteso  =${JSON.stringify(t.want)}`)));
  const bad = res.filter(t => !t.pass).length;
  console.log(`\n${res.length - bad}/${res.length} test superati`);
  if (errors.length) console.log('errori pagina:', errors);
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
