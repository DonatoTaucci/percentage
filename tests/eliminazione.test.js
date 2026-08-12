// Eliminazione di un account dalla scheda di amministrazione.
//
// Qui si verifica solo il lato client: che il pulsante non compaia dove non
// deve, che una motivazione troppo corta non faccia partire niente, e che
// l'esito venga riportato per quello che è — "eliminato" e "eliminato ma
// l'email non è partita" sono due risultati diversi e chi amministra deve
// distinguerli, perché nel secondo caso deve scrivere a mano.
//
// I controlli veri (sei amministratore? stai cancellando te stesso? un altro
// amministratore?) stanno nella funzione SQL e sono verificati sul database:
// qui si finge il server apposta, per poter provare i casi che il server non
// lascerebbe mai arrivare fin qui.
//
// Uso: python3 -m http.server 8765 &  →  node tests/eliminazione.test.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('percentage.lingua', 'it'); } catch (e) { /* ignorato */ }
  });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', d => d.accept());

  const BASE = process.env.BASE_URL || 'http://localhost:8765';
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.App && window.Admin, { timeout: 20000 });

  const log = [];
  const ok = (n, got, want) => log.push({ n, got, want, pass: JSON.stringify(got) === JSON.stringify(want) });

  /* Scena: tre utenti — uno qualunque, un amministratore, e io. */
  await page.evaluate(() => {
    window.__chiamate = [];
    window.__esito = { ok: true, email: 'tizio@example.com', account_chiuso: true, email_inviata: true, note: 'righe: eliminate · email: inviata' };
    window.Cloud = {
      stato: () => ({ supabase: null, utente: { id: 'user_admin', email: 'admin@example.com' }, pronto: true, motivo: 'ok' }),
      configurato: () => true,
      connesso: () => true,
      onChange: () => {},
      chiamaFunzione: (nome, corpo) => {
        window.__chiamate.push({ nome, corpo });
        return window.__esito instanceof Error ? Promise.reject(window.__esito) : Promise.resolve(window.__esito);
      },
    };
    window.Admin.stato = () => ({ verificato: true, admin: true, motivo: 'ok', errore: null });

    window.__ruoli = [
      { codice: 'utente', etichetta: 'Utente', descrizione: '', quota_ia: 40, ia_illimitata: false, salta_abbonamento: false, amministratore: false, colore: 'neutro' },
      { codice: 'admin', etichetta: 'Amministratore', descrizione: '', quota_ia: null, ia_illimitata: true, salta_abbonamento: true, amministratore: true, colore: 'bad' },
    ];
    window.__utenti = [
      { user_id: 'user_tizio', email: 'tizio@example.com', username: 'tizio', turni: 3, checkin: 1, timbratura_aperta: false, ruoli: [], ia_mese: 2, ia_limite: 40, ultima_attivita: new Date().toISOString() },
      { user_id: 'user_capo', email: 'capo@example.com', username: 'capo', turni: 1, checkin: 0, timbratura_aperta: false, ruoli: ['admin'], ia_mese: 0, ia_limite: -1, ultima_attivita: new Date().toISOString() },
      { user_id: 'user_admin', email: 'admin@example.com', username: 'io', turni: 0, checkin: 0, timbratura_aperta: false, ruoli: [], ia_mese: 0, ia_limite: 40, ultima_attivita: new Date().toISOString() },
    ];
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  });

  /* Disegna la scheda con un utente aperto, senza passare dal server. */
  const apri = (userId) => page.evaluate((id) => {
    Object.assign(window.App.ctx, {
      view: 'admin',
      adminRuoli: window.__ruoli,
      adminUtenti: window.__utenti,
      adminEliminazioni: [],
      adminErrore: null,
      adminDati: { userId: id, shifts: [], checkins: [], settings: null, punch: null },
    });
    window.App.render();
  }, userId);

  await apri('user_tizio');
  ok('su un utente qualunque il pulsante c\'è',
    await page.evaluate(() => !!document.querySelector('[data-action="admin-elimina-utente"]')), true);

  await apri('user_capo');
  ok('su un amministratore il pulsante non c\'è, e spiega perché',
    await page.evaluate(() => ({
      pulsante: !!document.querySelector('[data-action="admin-elimina-utente"]'),
      spiegato: /togli prima il ruolo/.test(document.getElementById('main').textContent),
    })),
    { pulsante: false, spiegato: true });

  await apri('user_admin');
  ok('su sé stessi il pulsante non c\'è, e rimanda alle impostazioni',
    await page.evaluate(() => ({
      pulsante: !!document.querySelector('[data-action="admin-elimina-utente"]'),
      spiegato: /si chiude dalle impostazioni/.test(document.getElementById('main').textContent),
    })),
    { pulsante: false, spiegato: true });

  /* Il modulo: motivazione troppo corta → non parte niente. */
  await apri('user_tizio');
  await page.locator('[data-action="admin-elimina-utente"]').first().click();
  await page.waitForTimeout(200);
  ok('il modulo mostra a chi si riferisce',
    await page.evaluate(() => document.getElementById('modal-body').textContent.includes('tizio@example.com')), true);

  await page.evaluate(() => {
    const t = document.querySelector('#modal-body [name=motivo]');
    t.value = 'corta';
    document.querySelector('#modal-body button[type=submit]').click();
  });
  await page.waitForTimeout(300);
  ok('motivazione corta: nessuna chiamata, e un avviso che dice perché',
    await page.evaluate(() => ({
      chiamate: window.__chiamate.length,
      avviso: /almeno 10/.test(document.getElementById('toast').textContent),
      modaleAperto: document.getElementById('modal').open !== false,
    })),
    { chiamate: 0, avviso: true, modaleAperto: true });

  /* Motivazione valida → una chiamata sola, con quello che serve. */
  await page.evaluate(() => {
    document.querySelector('#modal-body [name=motivo]').value = 'Uso contrario alle condizioni, segnalato due volte.';
    document.querySelector('#modal-body button[type=submit]').click();
  });
  await page.waitForTimeout(500);
  ok('eliminazione: una chiamata, con utente e motivazione',
    await page.evaluate(() => {
      const c = window.__chiamate;
      return {
        quante: c.length,
        nome: (c[0] || {}).nome,
        utente: ((c[0] || {}).corpo || {}).user_id,
        motivo: (((c[0] || {}).corpo || {}).motivo || '').slice(0, 20),
      };
    }),
    { quante: 1, nome: 'elimina-utente', utente: 'user_tizio', motivo: 'Uso contrario alle c' });

  ok('esito riuscito: dice a chi è andata l\'email',
    await page.evaluate(() => /Email inviata a tizio@example.com/.test(document.getElementById('toast').textContent)), true);

  /* Email non partita: l'account non c'è più comunque, e va detto. */
  await page.evaluate(() => {
    window.__chiamate = [];
    window.__esito = { ok: true, email: 'tizio@example.com', account_chiuso: true, email_inviata: false, note: 'email: invio non configurato' };
  });
  await apri('user_tizio');
  await page.locator('[data-action="admin-elimina-utente"]').first().click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelector('#modal-body [name=motivo]').value = 'Motivazione sufficientemente lunga.';
    document.querySelector('#modal-body button[type=submit]').click();
  });
  await page.waitForTimeout(500);
  ok('email non partita: lo dice e chiede di avvisare a mano',
    await page.evaluate(() => {
      const t = document.getElementById('toast').textContent;
      return { eliminato: /eliminato/i.test(t), avvisa: /a mano/.test(t) };
    }),
    { eliminato: true, avvisa: true });

  /* Rifiuto del server: il codice tecnico non arriva mai a schermo. */
  await page.evaluate(() => {
    window.__esito = Object.assign(new Error('e-amministratore'), { dati: {} });
  });
  await apri('user_tizio');
  await page.locator('[data-action="admin-elimina-utente"]').first().click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelector('#modal-body [name=motivo]').value = 'Motivazione sufficientemente lunga.';
    document.querySelector('#modal-body button[type=submit]').click();
  });
  await page.waitForTimeout(500);
  ok('rifiuto del server: frase leggibile, non il codice',
    await page.evaluate(() => {
      const t = document.getElementById('toast').textContent;
      return { spiegato: /togli prima il ruolo/.test(t), niente_codice: !/e-amministratore/.test(t) };
    }),
    { spiegato: true, niente_codice: true });

  log.forEach(t => console.log((t.pass ? '  ok  ' : ' FAIL ') + t.n +
    (t.pass ? '' : `\n        ottenuto=${JSON.stringify(t.got)}\n        atteso  =${JSON.stringify(t.want)}`)));
  const bad = log.filter(t => !t.pass).length;
  console.log(`\n${log.length - bad}/${log.length} test superati`);
  if (errors.length) console.log('errori pagina:', errors);
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
