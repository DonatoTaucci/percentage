// Test di calcolo eseguiti nel browser (riuso di calc.js così com'è).
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const BASE = process.env.BASE_URL || 'http://localhost:8765';
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });

  const out = await page.evaluate(() => {
    const res = [];
    const ok = (name, got, want) => res.push({ name, got, want, pass: JSON.stringify(got) === JSON.stringify(want) });
    const S = { oreGiornaliere: 8, giorniLavorativi: [1,2,3,4,5], pausaPredefinita: 60, pausaRetribuita: false,
                sogliaStraordinario: 8, maggiorazione: 25, pagaOraria: 15, valuta: '€', oreMensiliFisse: 0, inizioSettimana: 1 };

    // durata turni
    ok('9-18 con 60m pausa', Calc.shiftMinutes({ start:'09:00', end:'18:00', breakMin:60, tipo:'lavoro' }, S), 480);
    ok('turno notturno 22-06 con 30m', Calc.shiftMinutes({ start:'22:00', end:'06:00', breakMin:30, tipo:'lavoro' }, S), 450);
    ok('pausa retribuita', Calc.shiftMinutes({ start:'09:00', end:'18:00', breakMin:60, tipo:'lavoro' },
        Object.assign({}, S, { pausaRetribuita:true })), 540);
    ok('ferie non produce ore', Calc.shiftMinutes({ start:'', end:'', breakMin:0, tipo:'ferie' }, S), 0);

    // lunedì 2026-08-03 (giorno lavorativo)
    const lun = '2026-08-03', sab = '2026-08-08';
    let d = Calc.daySummary(lun, [{ id:'a', date:lun, start:'09:00', end:'19:00', breakMin:60, tipo:'lavoro' }], S);
    ok('straordinario giornaliero', [d.worked, d.target, d.overtime, Math.round(d.pct)], [540, 480, 60, 113]);

    // lavoro nel weekend: tutto straordinario
    d = Calc.daySummary(sab, [{ id:'b', date:sab, start:'09:00', end:'13:00', breakMin:0, tipo:'lavoro' }], S);
    ok('sabato tutto straordinario', [d.target, d.overtime], [0, 240]);

    // assenza + lavoro nello stesso giorno: niente doppio conteggio
    d = Calc.daySummary(lun, [
      { id:'c', date:lun, start:'09:00', end:'13:00', breakMin:0, tipo:'lavoro' },
      { id:'d', date:lun, tipo:'permesso', start:'', end:'', breakMin:0 }
    ], S);
    ok('lavoro + permesso = 100%', [d.worked, d.absence, d.credited, Math.round(d.pct)], [240, 240, 480, 100]);

    // ferie doppie nello stesso giorno non raddoppiano
    d = Calc.daySummary(lun, [
      { id:'e', date:lun, tipo:'ferie', start:'', end:'', breakMin:0 },
      { id:'f', date:lun, tipo:'ferie', start:'', end:'', breakMin:0 }
    ], S);
    ok('ferie duplicate = 100%', Math.round(d.pct), 100);

    // settimana completa 3-9 agosto 2026 (lun-dom)
    const turni = ['2026-08-03','2026-08-04','2026-08-05','2026-08-06','2026-08-07'].map((dt,i) =>
      ({ id:'w'+i, date:dt, start:'09:00', end:'18:00', breakMin:60, tipo:'lavoro' }));
    let w = Calc.rangeSummary('2026-08-03','2026-08-09', turni, S);
    ok('settimana piena 100%', [w.worked, w.target, Math.round(w.pct), w.overtime], [2400, 2400, 100, 0]);

    // monte ore mensile fisso
    let m = Calc.rangeSummary(Calc.monthStart('2026-08-10'), Calc.monthEnd('2026-08-10'), turni,
      Object.assign({}, S, { oreMensiliFisse: 168 }), { targetOverrideMinutes: 168*60 });
    ok('override monte ore', m.target, 10080);

    // settimana ISO e navigazione mesi
    ok('inizio settimana lunedì', Calc.weekStart('2026-08-06', 1), '2026-08-03');
    ok('mese precedente da 31/03', Calc.addMonths('2026-03-31', -1), '2026-02-28');
    ok('formato durata', [Calc.fmtDuration(495), Calc.fmtDuration(60), Calc.fmtDuration(-90)], ['8h 15m','1h','−1h 30m']);

    // paga straordinari
    ok('paga straordinari', Math.round(Calc.overtimePay(120, S) * 100) / 100, 37.5);

    // rischio oggettivo: 6 settimane pesanti senza riposo
    const heavy = [];
    for (let i = 27; i >= 0; i--) {
      const dt = Calc.addDays(Calc.today(), -i);
      heavy.push({ id:'h'+i, date:dt, start:'08:00', end:'20:00', breakMin:0, tipo:'lavoro' });
    }
    const met = Coach.workMetrics(heavy, S);
    const obj = Coach.objectiveRisk(met);
    ok('28 giorni da 12h -> rischio alto', obj.score >= 70, true);
    ok('streak rilevata', met.streakMax, 28);
    ok('giorni senza pausa rilevati', met.giorniSenzaPausa, 28);

    const ev = Coach.evaluate(null, heavy, S);
    ok('consigli generati', ev.advice.length > 0, true);
    ok('livello critico', ev.level.key === 'elevato' || ev.level.key === 'critico', true);

    // profilo sano
    const light = [];
    for (let i = 27; i >= 0; i--) {
      const dt = Calc.addDays(Calc.today(), -i);
      if ([0,6].includes(Calc.dow(dt))) continue;
      light.push({ id:'l'+i, date:dt, start:'09:00', end:'18:00', breakMin:60, tipo:'lavoro' });
    }
    const evL = Coach.evaluate(null, light, S);
    ok('profilo regolare -> rischio basso', evL.level.key, 'basso');

    return res;
  });

  const failed = out.filter(t => !t.pass);
  out.forEach(t => console.log((t.pass ? '  ok  ' : ' FAIL ') + t.name + (t.pass ? '' : `  got=${JSON.stringify(t.got)} want=${JSON.stringify(t.want)}`)));
  console.log(`\n${out.length - failed.length}/${out.length} test superati`);
  if (errors.length) console.log('errori pagina:', errors);
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})();
