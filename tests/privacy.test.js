// Consensi, trasparenza sull'IA e accesso ai documenti.
//
// Le asserzioni interessanti sono due, e sono negative: senza consenso il
// questionario non deve aprirsi, e senza consenso non deve partire nessuna
// richiesta di rete verso il modello. Un pannello nascosto non è un
// controllo — qui si verifica che il modulo che invia si rifiuti davvero.
//
// Uso: python3 -m http.server 8765 &  →  node tests/privacy.test.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  // Le asserzioni sono sui testi italiani: il profilo non deve arrivare con
  // un'altra lingua salvata da una prova precedente.
  await page.addInitScript(() => {
    try { localStorage.setItem('percentage.lingua', 'it'); } catch (e) { /* ignorato */ }
  });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  const BASE = process.env.BASE_URL || 'http://localhost:8765';
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.App && window.Legale, { timeout: 20000 });
  await page.waitForFunction(() => window.Cloud && window.Cloud.stato().pronto, { timeout: 25000 });

  const log = [];
  const ok = (n, got, want) => log.push({ n, got, want, pass: JSON.stringify(got) === JSON.stringify(want) });

  /* 1. L'informativa si legge prima di avere un account. */
  ok('la presentazione è chiusa a chi non ha effettuato l\'accesso',
    await page.evaluate(() => !document.getElementById('landing').classList.contains('hidden')), true);

  await page.locator('#landing [data-action="doc"][data-doc="privacy"]').first().click();
  await page.waitForTimeout(250);
  const doc = await page.evaluate(() => ({
    titolo: (document.querySelector('#landing .doc h2') || {}).textContent || '',
    sezioni: document.querySelectorAll('#landing .doc-sez').length,
    reclamo: /garanteprivacy/.test(document.getElementById('landing').textContent),
  }));
  ok('informativa leggibile dalla presentazione', /Informativa/.test(doc.titolo), true);
  ok('con tutte le sezioni', doc.sezioni >= 8, true);
  ok('e l\'autorità a cui rivolgere il reclamo', doc.reclamo, true);

  await page.locator('#landing [data-action="doc"][data-doc="ia"]').first().click();
  await page.waitForTimeout(200);
  ok('la nota sull\'IA dichiara l\'uso non previsto',
    await page.evaluate(() => /alto rischio/.test(document.getElementById('landing').textContent)), true);

  await page.locator('#landing [data-action="chiudi-doc"]').first().click();
  await page.waitForTimeout(200);
  ok('si torna alla presentazione', await page.evaluate(() => !!document.querySelector('#landing .hero')), true);

  /* 2. Il questionario non si apre senza consenso. */
  await page.evaluate(() => {
    window.Cloud = {
      stato: () => ({ supabase: null, utente: { id: 'u1' }, pronto: true, motivo: 'ok' }),
      configurato: () => true, connesso: () => true, onChange: () => {},
    };
    window.App.renderGate();
    window.App.go('benessere');
  });
  await page.waitForTimeout(250);
  await page.locator('[data-action="start-quiz"]').first().click();
  await page.waitForTimeout(250);
  const prima = await page.evaluate(() => ({
    riquadro: !!document.querySelector('.consenso'),
    domande: document.querySelectorAll('.q').length,
    registrato: window.Store.consenso('benessere'),
  }));
  ok('senza consenso compare la richiesta, non le domande', prima, { riquadro: true, domande: 0, registrato: false });

  await page.locator('[data-action="consenti"][data-consenso="benessere"]').first().click();
  await page.waitForTimeout(250);
  const dopo = await page.evaluate(() => ({
    domande: document.querySelectorAll('.q').length > 0,
    registrato: window.Store.consenso('benessere'),
    conData: !!window.Store.dataConsenso('benessere'),
  }));
  ok('dato il consenso il questionario si apre, con la data', dopo, { domande: true, registrato: true, conData: true });

  /* 3. L'IA: l'accesso da solo non basta, serve il consenso. La richiesta
        parte verso la funzione sul server, che qui non esiste: si conta se
        qualcuno prova a chiamarla, ed è proprio quello che non deve accadere. */
  let chiamate = 0;
  await page.route('**/functions/v1/**', (route) => { chiamate++; route.abort(); });
  await page.evaluate(() => {
    window.App.ctx.quizOpen = false;
    window.App.ctx.chat = [];
    window.App.go('benessere');
  });
  await page.waitForTimeout(250);
  ok('con l\'accesso ma senza consenso il campo non c\'è',
    await page.evaluate(() => ({ riquadro: !!document.querySelector('.consenso'), campo: !!document.getElementById('ai-input') })),
    { riquadro: true, campo: false });

  const forzato = await page.evaluate(() => {
    const prima = window.App.ctx.chat.length;
    window.App.aiSend('prova');
    return { cresciuta: window.App.ctx.chat.length > prima, avviso: /consenso/i.test(document.getElementById('toast').textContent) };
  });
  await page.waitForTimeout(400);
  ok('forzando l\'invio non parte nulla', { ...forzato, chiamate }, { cresciuta: false, avviso: true, chiamate: 0 });

  await page.evaluate(() => {
    window.Store.impostaConsenso('ia', true);
    window.App.ctx.chat = [{ role: 'assistant', content: 'ciao' }];
    window.App.render();
  });
  await page.waitForTimeout(250);
  ok('dato il consenso compare il campo, e la risposta è etichettata',
    await page.evaluate(() => ({ campo: !!document.getElementById('ai-input'), etichetta: !!document.querySelector('.msg-ia-tag') })),
    { campo: true, etichetta: true });

  /* 3b. Quota e ruoli, e i messaggi di errore che ne derivano.

        Sono la parte che l'utente legge quando qualcosa non va, ed è quella
        in cui è più facile mostrargli un codice al posto di una frase. */
  await page.evaluate(() => {
    window.AI.stato = () => ({ caricato: true, usati: 28, limite: 40,
      ruoli: [{ codice: 'tester', etichetta: 'Tester', colore: 'info', descrizione: 'prova' }] });
    window.App.render();
  });
  await page.waitForTimeout(200);
  ok('quota e distintivo del ruolo sono in pagina',
    await page.evaluate(() => {
      const t = document.getElementById('main').textContent;
      return { quota: t.includes('12 messaggi rimasti'), ruolo: t.includes('Tester') };
    }),
    { quota: true, ruolo: true });

  // Quota esaurita: è un limite, non un guasto, e va detto con i numeri.
  await page.evaluate(() => {
    window.Cloud.chiamaFunzione = () => Promise.reject(
      Object.assign(new Error('quota-esaurita'), { dati: { limite: 40, usati: 40 } }));
    window.App.ctx.chat = [];
    window.App.aiSend('e adesso?');
  });
  await page.waitForTimeout(400);
  ok('quota esaurita: messaggio comprensibile, non un codice',
    await page.evaluate(() => {
      const ultimo = window.App.ctx.chat[window.App.ctx.chat.length - 1] || {};
      return { dice40: /40/.test(ultimo.content || ''), niente_codice: !/quota-esaurita/.test(ultimo.content || '') };
    }),
    { dice40: true, niente_codice: true });

  // Servizio non configurato: è un problema di chi gestisce, non dell'utente.
  await page.evaluate(() => {
    window.Cloud.chiamaFunzione = () => Promise.reject(Object.assign(new Error('chiave-mancante'), { dati: {} }));
    window.App.ctx.chat = [];
    window.App.aiSend('ci sei?');
  });
  await page.waitForTimeout(400);
  ok('servizio spento: lo dice, senza incolpare l\'utente',
    await page.evaluate(() => /non è ancora configurato/.test((window.App.ctx.chat[1] || {}).content || '')), true);

  await page.evaluate(() => { window.App.ctx.chat = []; window.App.render(); });

  /* 4. La revoca è un clic come il consenso, e svuota la conversazione. */
  await page.locator('[data-action="revoca-ia"]').first().click();
  await page.waitForTimeout(250);
  ok('revoca: consenso tolto e conversazione svuotata',
    await page.evaluate(() => ({ registrato: window.Store.consenso('ia'), chat: window.App.ctx.chat.length })),
    { registrato: false, chat: 0 });

  /* 5. Le impostazioni: i due consensi e la cancellazione. */
  await page.evaluate(() => window.App.go('impostazioni'));
  await page.waitForTimeout(250);
  ok('impostazioni: consensi, cancellazione, e nessuna promessa falsa',
    await page.evaluate(() => ({
      consensi: document.querySelectorAll('[data-consenso]').length,
      elimina: !!document.querySelector('[data-action="elimina-account"]'),
      // La riga "nessun dato viene inviato a un server" era vera prima della
      // sincronizzazione, ed è diventata falsa senza che nessuno la aggiornasse.
      fraseFalsa: document.getElementById('main').textContent.includes('Nessun dato viene inviato a un server'),
    })),
    { consensi: 2, elimina: true, fraseFalsa: false });

  log.forEach(t => console.log((t.pass ? '  ok  ' : ' FAIL ') + t.n +
    (t.pass ? '' : `\n        ottenuto=${JSON.stringify(t.got)}\n        atteso  =${JSON.stringify(t.want)}`)));
  const bad = log.filter(t => !t.pass).length;
  console.log(`\n${log.length - bad}/${log.length} test superati`);
  if (errors.length) console.log('errori pagina:', errors);
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
