// Il modulo di accesso resta dentro il sito.
//
// La verifica che conta è negativa: durante l'iscrizione non si deve mai
// finire su <dominio>.accounts.dev. Ci si finiva perché la finestra modale di
// Clerk non ha un indirizzo proprio, e ogni passaggio che ha bisogno di un
// ritorno — il rimbalzo di OAuth, i campi mancanti — atterrava sul portale
// ospitato. Qui si controlla che il componente venga montato in pagina con
// routing 'hash', e che un frammento lasciato da un passaggio interrotto
// riapra il pannello invece della presentazione.
//
// Clerk non è raggiungibile da questo ambiente, quindi il montaggio vero non
// si può provare: si sostituisce il modulo cloud e si guarda con quali
// argomenti viene chiamato, che è esattamente ciò che decide dove si finisce.
//
// Uso: python3 -m http.server 8765 &  →  node tests/accesso.test.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('percentage.lingua', 'it'); } catch (e) { /* ignorato */ }
  });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  const BASE = process.env.BASE_URL || 'http://localhost:8765';
  const log = [];
  const ok = (n, got, want) => log.push({ n, got, want, pass: JSON.stringify(got) === JSON.stringify(want) });

  /* Cloud finto: registra montaggi e smontaggi, e finge una sessione assente. */
  const fingiCloud = () => page.evaluate(() => {
    window.__montaggi = [];
    window.__smontaggi = 0;
    window.__utente = null;
    window.Cloud = {
      stato: () => ({ supabase: null, utente: window.__utente, pronto: true, disponibile: true, motivo: 'ok' }),
      configurato: () => true,
      connesso: () => !!window.__utente,
      onChange: () => {},
      riprova: () => Promise.resolve({ disponibile: true }),
      montaAccesso: (nodo, registrazione) => {
        window.__montaggi.push({ registrazione: !!registrazione, dentroAlSito: !!nodo && document.body.contains(nodo) });
        return true;
      },
      smontaAccesso: () => { window.__smontaggi++; },
      sincronizza: () => Promise.resolve(null),
    };
    window.App.renderGate();
  });

  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.App && window.UI, { timeout: 20000 });
  await page.waitForFunction(() => window.Cloud && window.Cloud.stato().pronto, { timeout: 25000 });
  await fingiCloud();
  await page.waitForTimeout(200);

  ok('senza sessione si vede la presentazione',
    await page.evaluate(() => !!document.querySelector('#landing .hero')), true);

  /* Entra: il componente viene montato in pagina, non in una finestra. */
  await page.locator('#landing [data-action="entra"]').first().click();
  await page.waitForTimeout(250);
  ok('"Entra" monta il modulo dentro il sito',
    await page.evaluate(() => ({
      montaggi: window.__montaggi.length,
      registrazione: (window.__montaggi[0] || {}).registrazione,
      dentroAlSito: (window.__montaggi[0] || {}).dentroAlSito,
      contenitore: !!document.getElementById('clerk-accesso'),
      modaleAperto: !!document.querySelector('dialog[open]'),
    })),
    { montaggi: 1, registrazione: false, dentroAlSito: true, contenitore: true, modaleAperto: false });

  ok('il pannello offre la via d\'uscita e l\'informativa',
    await page.evaluate(() => ({
      indietro: !!document.querySelector('[data-action="chiudi-accesso"]'),
      privacy: !!document.querySelector('#landing [data-action="doc"][data-doc="privacy"]'),
    })),
    { indietro: true, privacy: true });

  /* Notifiche del modulo cloud mentre il pannello è aperto: il nodo montato
     non va ridisegnato, o una verifica via email morirebbe a metà. */
  const nodoPrima = await page.evaluate(() => {
    document.getElementById('clerk-accesso').setAttribute('data-segno', 'x');
    window.App.renderGate();
    window.App.renderGate();
    return document.getElementById('clerk-accesso').getAttribute('data-segno');
  });
  ok('il nodo montato sopravvive ai ridisegni', { segno: nodoPrima, montaggi: await page.evaluate(() => window.__montaggi.length) },
    { segno: 'x', montaggi: 1 });

  /* Torna indietro: smonta e ripulisce il frammento. */
  await page.evaluate(() => { history.replaceState(null, '', location.pathname + '#/factor-one'); });
  await page.locator('[data-action="chiudi-accesso"]').first().click();
  await page.waitForTimeout(250);
  ok('"Torna indietro" smonta, ripulisce l\'indirizzo e riporta alla presentazione',
    await page.evaluate(() => ({
      smontaggi: window.__smontaggi,
      hash: location.hash,
      hero: !!document.querySelector('#landing .hero'),
    })),
    { smontaggi: 1, hash: '', hero: true });

  /* Registrati: stesso pannello, altro componente. */
  await page.locator('#landing [data-action="registrati"]').first().click();
  await page.waitForTimeout(250);
  ok('"Registrati" monta il modulo di iscrizione',
    await page.evaluate(() => {
      const ultimo = window.__montaggi[window.__montaggi.length - 1] || {};
      return { quanti: window.__montaggi.length, registrazione: ultimo.registrazione };
    }),
    { quanti: 2, registrazione: true });

  /* Sessione ottenuta: il pannello si chiude e l'indirizzo torna pulito. */
  await page.evaluate(() => {
    history.replaceState(null, '', location.pathname + '#/continue');
    window.__utente = { id: 'u1', email: 'x@example.com' };
    window.App.renderGate();
  });
  await page.waitForTimeout(250);
  ok('entrati: pannello smontato, frammento ripulito, applicazione visibile',
    await page.evaluate(() => ({
      smontaggi: window.__smontaggi,
      hash: location.hash,
      app: !document.getElementById('app').classList.contains('hidden'),
    })),
    { smontaggi: 2, hash: '', app: true });

  /* Ritorno da OAuth: la pagina si apre con un frammento di Clerk e deve
     riprendere da lì, non mostrare la presentazione come se niente fosse. */
  // goto verso lo stesso indirizzo cambiando solo il frammento è una
  // navigazione nello stesso documento: la pagina non si ricarica e non
  // proverebbe niente. Il reload la costringe a ripartire davvero.
  await page.goto(BASE + '/index.html#/sign-up/continue', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.App && window.UI, { timeout: 20000 });
  await page.waitForTimeout(1200);
  ok('un frammento di Clerk riapre il pannello da solo',
    await page.evaluate(() => ({
      contenitore: !!document.getElementById('clerk-accesso'),
      hero: !!document.querySelector('#landing .hero'),
    })),
    { contenitore: true, hero: false });

  log.forEach(t => console.log((t.pass ? '  ok  ' : ' FAIL ') + t.n +
    (t.pass ? '' : `\n        ottenuto=${JSON.stringify(t.got)}\n        atteso  =${JSON.stringify(t.want)}`)));
  const bad = log.filter(t => !t.pass).length;
  console.log(`\n${log.length - bad}/${log.length} test superati`);
  if (errors.length) console.log('errori pagina:', errors);
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
