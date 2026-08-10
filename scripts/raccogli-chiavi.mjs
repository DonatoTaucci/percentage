/* Raccoglie le chiavi di traduzione rendendo davvero ogni schermata.

   Le frasi dell'interfaccia nascono dalla concatenazione di pezzi, quindi
   esistono solo a pagina disegnata: leggerle dal sorgente darebbe frammenti
   incollati a numeri. Qui si apre il sito in un browser, si riempie di dati
   d'esempio, si passa per ogni vista e si prende il testo come lo legge
   l'utente, con i numeri già sostituiti da segnaposto.

   Uso:  node scripts/raccogli-chiavi.mjs            (scrive js/lang/_chiavi.json)
         node scripts/raccogli-chiavi.mjs --verifica  (esce 1 se ci sono novità) */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright è installato globalmente: import() non guarda in NODE_PATH.
const richiedi = createRequire(import.meta.url);
const { chromium } = richiedi(process.env.PLAYWRIGHT_PATH || 'playwright');

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = resolve(radice, 'js/lang/_chiavi.json');
const PORTA = 8911;

const server = spawn('python3', ['-m', 'http.server', String(PORTA)], { cwd: radice, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage();
// Le chiavi sono i testi italiani: se il profilo avesse un'altra lingua salvata
// raccoglieremmo frasi già tradotte, o peggio metà e metà.
await page.addInitScript(() => {
  try { localStorage.setItem('percentage.lingua', 'it'); } catch (e) { /* ignorato */ }
});
await page.goto(`http://localhost:${PORTA}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.App && window.I18n, { timeout: 20000 });

/* Funzione di raccolta, eseguita dentro la pagina. */
await page.evaluate(() => {
  window.__chiavi = new Set();
  window.__raccogli = (radice) => {
    if (!radice) return;
    const salta = new Set(['SCRIPT', 'STYLE', 'CODE', 'TEXTAREA', 'KBD']);
    const w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) {
      const n = w.currentNode;
      if (!n.nodeValue || !/[A-Za-zÀ-ÿ]/.test(n.nodeValue)) continue;
      let fuori = false;
      for (let el = n.parentElement; el; el = el.parentElement) {
        if (salta.has(el.tagName) || el.hasAttribute('data-no-i18n')) { fuori = true; break; }
      }
      if (fuori) continue;
      const k = window.I18n.chiaveDi(n.nodeValue);
      if (k) window.__chiavi.add(k);
    }
    for (const attr of ['title', 'aria-label', 'placeholder']) {
      radice.querySelectorAll(`[${attr}]`).forEach((el) => {
        if (el.closest('[data-no-i18n]')) return;
        const k = window.I18n.chiaveDi(el.getAttribute(attr));
        if (k) window.__chiavi.add(k);
      });
    }
  };
});

/* 1. La landing, che si vede prima dell'accesso. */
await page.waitForFunction(() => window.Cloud && window.Cloud.stato().pronto, { timeout: 25000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__raccogli(document.getElementById('landing')));

/* 2. L'applicazione, con dati d'esempio che accendono ogni ramo del codice. */
await page.evaluate(() => {
  const app = document.getElementById('app');
  app.classList.remove('hidden');
  document.getElementById('landing').classList.add('hidden');

  const oggi = window.Calc.today();
  const giorno = (n) => window.Calc.toISO(new Date(Date.now() - n * 86400000));

  window.Store.updateSettings({ geo: { attivo: true, lat: 45.1, lng: 9.1, raggio: 150, etichetta: 'Ufficio' } });
  window.Store.saveShift({ date: oggi, start: '09:00', end: '18:30', breakMin: 60, tipo: 'lavoro', note: 'consegna' });
  window.Store.saveShift({ date: giorno(1), start: '09:00', end: '18:00', breakMin: 60, tipo: 'lavoro' });
  window.Store.saveShift({ date: giorno(2), start: '22:00', end: '06:00', breakMin: 30, tipo: 'lavoro' });
  window.Store.saveShift({ date: giorno(3), tipo: 'ferie' });
  window.Store.saveShift({ date: giorno(4), tipo: 'malattia' });
  window.Store.saveShift({ date: giorno(5), tipo: 'permesso' });
  window.Store.saveShift({ date: giorno(6), tipo: 'festivo' });
});

for (const vista of ['dashboard', 'turni', 'statistiche', 'benessere', 'impostazioni']) {
  await page.evaluate((v) => window.App.go(v), vista);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__raccogli(document.getElementById('main'));
    window.__raccogli(document.querySelector('.topbar'));
    window.__raccogli(document.querySelector('.tabs'));
    window.__raccogli(document.querySelector('.foot'));
  });
}

/* 3. Il questionario del benessere, che è dietro un pulsante. */
await page.evaluate(() => { window.App.ctx.quizOpen = true; window.App.render(); });
await page.waitForTimeout(250);
await page.evaluate(() => window.__raccogli(document.getElementById('main')));

/* 4. Una timbratura in corso e una in pausa. */
for (const stato of ['aperta', 'pausa']) {
  await page.evaluate((s) => {
    window.Store.cancelPunch();
    window.Store.startPunch(Date.now() - 3 * 3600 * 1000);
    if (s === 'pausa') window.Store.toggleBreak(Date.now() - 600 * 1000);
    window.App.go('dashboard');
  }, stato);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__raccogli(document.getElementById('main')));
}
await page.evaluate(() => window.Store.cancelPunch());

/* 5. Il modale del turno, nuovo e in modifica. */
await page.evaluate(() => {
  const b = document.getElementById('modal-body');
  b.innerHTML = window.UI.shiftForm(null);
  window.__raccogli(b);
  b.innerHTML = window.UI.shiftForm(window.Store.shifts()[0]);
  window.__raccogli(b);
});

/* Non tutto ciò che è testo va tradotto. */
const ESCLUDI = [
  /^[\s{}\d%hm+\-–·/.,:()]*$/,          // solo numeri, unità e segni
  /^[\p{Emoji}\s]*(Italiano|English|Español|Français|Deutsch)$/u, // i nomi delle lingue restano nella loro lingua
  /^claude-/,                            // identificativi dei modelli
  /^(pk|sk|sb)_/,                        // chiavi
  /chiave Clerk:/,                       // riga diagnostica, composta a runtime
  /^https?:/,
  /^sk-ant-/,                            // segnaposto della chiave API
  /^Percentage$/,                        // il nome del prodotto non si traduce
];

const chiavi = await page.evaluate(() => [...window.__chiavi]);
await browser.close();
server.kill();

/* Nomi di mesi e giorni: li traduce Intl, non il dizionario. Li escludiamo
   confrontandoli con quelli veri, invece di indovinarli con un'espressione
   regolare che prima o poi mangerebbe una parola legittima. */
const date = new Set();
for (const formato of ['long', 'short']) {
  for (let m = 0; m < 12; m++) {
    date.add(new Intl.DateTimeFormat('it', { month: formato, timeZone: 'UTC' })
      .format(new Date(Date.UTC(2024, m, 1))));
  }
  for (let g = 0; g < 7; g++) {
    date.add(new Intl.DateTimeFormat('it', { weekday: formato, timeZone: 'UTC' })
      .format(new Date(Date.UTC(2024, 0, 1) + g * 86400000)));
  }
}

const dateMinuscole = new Set([...date].map((n) => n.toLowerCase()));

const elenco = chiavi
  .filter((k) => k.length > 1)
  .filter((k) => !ESCLUDI.some((re) => re.test(k)))
  // Il confronto è insensibile alle maiuscole: l'interfaccia scrive "Lunedì"
  // dove Intl restituisce "lunedì".
  .filter((k) => !date.has(k) && !dateMinuscole.has(k.toLowerCase()))
  // Le frasi che incorporano una data formattata cambiano chiave ogni mese:
  // la parte variabile la traduce già Intl, il resto è punteggiatura.
  .filter((k) => ![...date].some((n) => new RegExp('\\b' + n + '\\b', 'i').test(k)))
  .sort((a, b) => a.localeCompare(b, 'it'));

const precedenti = existsSync(USCITA) ? JSON.parse(readFileSync(USCITA, 'utf8')) : [];
const nuove = elenco.filter((k) => !precedenti.includes(k));
const sparite = precedenti.filter((k) => !elenco.includes(k));

if (process.argv.includes('--verifica')) {
  if (nuove.length) console.error(`${nuove.length} chiavi nuove non ancora in _chiavi.json:\n  ` + nuove.join('\n  '));
  if (sparite.length) console.error(`${sparite.length} chiavi non più usate:\n  ` + sparite.join('\n  '));
  if (!nuove.length && !sparite.length) console.log(`${elenco.length} chiavi, nessuna novità.`);
  process.exit(nuove.length || sparite.length ? 1 : 0);
}

writeFileSync(USCITA, JSON.stringify(elenco, null, 2) + '\n');
console.log(`${elenco.length} chiavi scritte in js/lang/_chiavi.json`);
if (nuove.length) console.log(`  ${nuove.length} nuove`);
if (sparite.length) console.log(`  ${sparite.length} non più usate`);
