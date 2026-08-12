/* Raccoglie le chiavi di traduzione rendendo davvero ogni schermata.

   Le frasi dell'interfaccia nascono dalla concatenazione di pezzi, quindi
   esistono solo a pagina disegnata: leggerle dal sorgente darebbe frammenti
   incollati a numeri. Qui si apre il sito in un browser, si riempie di dati
   d'esempio, si passa per ogni vista e si prende il testo come lo legge
   l'utente, con i numeri già sostituiti da segnaposto.

   Uso:  node scripts/raccogli-chiavi.mjs            (scrive js/lang/_chiavi.json)
         node scripts/raccogli-chiavi.mjs --verifica  (esce 1 se ci sono novità)

   --pota toglie le chiavi non incontrate, e va usato con la mano ferma: molte
   frasi compaiono solo con certi dati (un turno notturno nel mese in corso, un
   profilo di rischio particolare, una media settimanale sotto le 48 ore), e in
   una passata che capita nel giorno sbagliato non si vedono. Sono vive lo
   stesso. Potare senza guardare l'elenco significa cancellarne le traduzioni. */

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

/* Le schermate si visitano tutte, e in tutti i loro stati.

   La prima versione di questo script raccoglieva solo ciò che capitava di
   vedere: con dati d'esempio caricati, gli stati vuoti ("Nessun turno
   registrato in…") non comparivano mai, e la finestra di accesso non
   riusciva a caricarsi in questo ambiente, quindi il pulsante "Entra" non
   esisteva. Le frasi mancanti restavano in italiano senza che nulla lo
   segnalasse. Ora ogni stato viene provocato di proposito. */

const raccogliVisibile = async () => {
  await page.evaluate(() => {
    window.__raccogli(document.getElementById('main'));
    window.__raccogli(document.querySelector('.topbar'));
    window.__raccogli(document.querySelector('.tabs'));
    window.__raccogli(document.querySelector('.foot'));
  });
};

const vaiA = async (vista) => {
  await page.evaluate((v) => {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('landing').classList.add('hidden');
    window.App.go(v);
  }, vista);
  await page.waitForTimeout(160);
  await raccogliVisibile();
};

/* 1. La landing, in tutti e quattro i suoi stati. */
await page.waitForFunction(() => window.Cloud && window.Cloud.stato().pronto, { timeout: 25000 });
for (const stato of [
  { pronto: true },
  { pronto: false },
  { pronto: true, errore: 'Servizio di accesso non raggiungibile: l\'app resta utilizzabile in locale.' },
  { pronto: true, errore: 'Servizio di accesso non raggiungibile: l\'app resta utilizzabile in locale.', giaAccesso: true },
]) {
  await page.evaluate((s) => {
    const l = document.getElementById('landing');
    l.classList.remove('hidden');
    l.innerHTML = window.UI.landing(s);
    window.__raccogli(l);
  }, stato);
}

/* 1b. Il pannello di accesso: la cornice è nostra (marchio, lingua, via
       d'uscita), il riquadro dentro lo disegna Clerk e non ci riguarda. */
for (const pronto of [true, false]) {
  await page.evaluate((p) => {
    const l = document.getElementById('landing');
    l.classList.remove('hidden');
    l.innerHTML = window.UI.pannelloAccesso({ pronto: p });
    window.__raccogli(l);
  }, pronto);
}

/* 1c. La scelta del nome utente: pulita e con un errore in vista. */
for (const c of [{}, { usernameBozza: 'mario', usernameErrore: 'Questo nome utente è già di qualcun altro. Provane un altro.' }]) {
  await page.evaluate((x) => {
    const l = document.getElementById('landing');
    l.classList.remove('hidden');
    l.innerHTML = window.UI.scegliUsername(x);
    window.__raccogli(l);
  }, c);
}

/* 2. L'applicazione completamente vuota: è ciò che vede chi entra la prima
      volta, ed è pieno di frasi che nessun altro stato mostra. */
await page.evaluate(() => {
  window.Store.shifts().slice().forEach((t) => window.Store.deleteShift(t.id));
  window.Store.cancelPunch();
  window.Store.updateSettings({ geo: { attivo: false, lat: null, lng: null, raggio: 150, etichetta: '' } });
});
for (const v of ['dashboard', 'turni', 'statistiche', 'benessere', 'impostazioni']) await vaiA(v);

/* 2b. Un mese e un anno senza dati, raggiunti navigando indietro. */
await page.evaluate(() => {
  window.App.ctx.turniMonth = '2019-03-01';
  window.App.ctx.statsYear = 2019;
});
for (const v of ['turni', 'statistiche']) await vaiA(v);

/* 3. Con i dati: ogni tipo di giornata, uno straordinario, un turno notturno. */
await page.evaluate(() => {
  const oggi = window.Calc.today();
  const giorno = (n) => window.Calc.toISO(new Date(Date.now() - n * 86400000));
  window.App.ctx.turniMonth = oggi;
  window.App.ctx.statsYear = window.Calc.fromISO(oggi).getFullYear();
  window.Store.updateSettings({
    geo: { attivo: true, lat: 45.1, lng: 9.1, raggio: 150, etichetta: 'Ufficio' },
    pagaOraria: 15, maggiorazioneStraordinario: 25,
  });
  window.Store.saveShift({ date: oggi, start: '09:00', end: '18:30', breakMin: 60, tipo: 'lavoro', note: 'consegna' });
  for (let n = 1; n <= 20; n++) {
    window.Store.saveShift({ date: giorno(n), start: '08:30', end: n % 5 === 0 ? '21:00' : '18:00', breakMin: n % 4 === 0 ? 0 : 60, tipo: 'lavoro' });
  }
  window.Store.saveShift({ date: giorno(22), start: '22:00', end: '06:00', breakMin: 30, tipo: 'lavoro' });
  ['ferie', 'malattia', 'permesso', 'festivo', 'riposo'].forEach((tipo, i) => {
    window.Store.saveShift({ date: giorno(24 + i), tipo });
  });
});
for (const v of ['dashboard', 'turni', 'statistiche', 'benessere', 'impostazioni']) await vaiA(v);

/* 4. Il questionario: aperto, e poi compilato in tre modi diversi, perché
      il profilo di rischio e i consigli cambiano con le risposte. */
await page.evaluate(() => { window.App.ctx.quizOpen = true; window.App.render(); });
await page.waitForTimeout(160);
await raccogliVisibile();

for (const modo of ['peggiore', 'medio', 'migliore']) {
  await page.evaluate((m) => {
    const risposte = {};
    window.Coach.QUESTIONS.forEach((q) => {
      risposte[q.id] = m === 'medio' ? 2 : (m === 'peggiore' ? (q.invert ? 0 : 4) : (q.invert ? 4 : 0));
    });
    const val = window.Coach.evaluate(risposte, window.Store.shifts(), window.Store.settings());
    window.Store.addCheckin({ id: 'test-' + m, ts: Date.now(), answers: risposte, score: val.score, level: val.level.id, dims: val.dims });
    window.App.ctx.quizOpen = false;
    window.App.go('benessere');
  }, modo);
  await page.waitForTimeout(200);
  await raccogliVisibile();
}

/* 5. Timbratura aperta e in pausa. */
for (const stato of ['aperta', 'pausa']) {
  await page.evaluate((s) => {
    window.Store.cancelPunch();
    window.Store.startPunch(Date.now() - 3 * 3600 * 1000);
    if (s === 'pausa') window.Store.toggleBreak(Date.now() - 600 * 1000);
    window.App.go('dashboard');
  }, stato);
  await page.waitForTimeout(200);
  await raccogliVisibile();
}
await page.evaluate(() => window.Store.cancelPunch());

/* 6. Il GPS: spento, acceso senza posizione, acceso con posizione. */
for (const geo of [
  { attivo: true, lat: null, lng: null, raggio: 150, etichetta: '' },
  { attivo: true, lat: 45.1, lng: 9.1, raggio: 150, etichetta: 'Ufficio', autoEntrata: false, autoUscita: false },
]) {
  await page.evaluate((g) => window.Store.updateSettings({ geo: g }), geo);
  await vaiA('dashboard');
  await vaiA('impostazioni');
}

/* 7. L'assistente. Gli stati sono quattro e nessuno si vede per caso: senza
      account, con account ma senza consenso, con il consenso, e con la quota
      esaurita. Quota e ruoli arrivano dal server, che qui non risponde:
      si sostituiscono, perché servono le frasi, non i numeri veri. */
await page.evaluate(() => {
  window.Store.updateSettings({ consensi: { benessere: null, ia: null } });
  window.App.ctx.chat = [];
});
for (const v of ['benessere', 'impostazioni']) await vaiA(v);   // senza account

await page.evaluate(() => {
  window.AI.disponibile = () => true;
  window.AI.stato = () => ({ caricato: true, usati: 12, limite: 40, ruoli: [] });
  window.Cloud.connesso = () => true;
});
for (const v of ['benessere', 'impostazioni']) await vaiA(v);   // senza consenso

/* 7b. Il consenso al questionario, che si vede solo aprendolo senza averlo dato. */
await page.evaluate(() => { window.App.ctx.quizOpen = true; window.App.go('benessere'); });
await page.waitForTimeout(160);
await raccogliVisibile();
await page.evaluate(() => { window.App.ctx.quizOpen = false; });

await page.evaluate(() => {
  window.Store.impostaConsenso('benessere', true);
  window.Store.impostaConsenso('ia', true);
  window.App.ctx.chat = [{ role: 'user', content: 'ciao' }, { role: 'assistant', content: 'ciao a te' }];
});
for (const v of ['benessere', 'impostazioni']) await vaiA(v);

// conversazione vuota: è il primo schermo di chi apre la sezione, e nessun
// altro stato mostra la frase di benvenuto
await page.evaluate(() => { window.App.ctx.chat = []; window.App.go('benessere'); });
await page.waitForTimeout(160);
await raccogliVisibile();
await page.evaluate(() => {
  window.App.ctx.chat = [{ role: 'user', content: 'ciao' }, { role: 'assistant', content: 'ciao a te' }];
});

// con un ruolo e senza limite
await page.evaluate(() => {
  window.AI.stato = () => ({
    caricato: true, usati: 120, limite: -1,
    ruoli: [{ codice: 'founder', etichetta: 'Founder', colore: 'ok', descrizione: 'senza limiti' }],
  });
});
for (const v of ['benessere', 'impostazioni']) await vaiA(v);

// i messaggi di errore del modulo, che nessuna schermata mostra da sola
await page.evaluate(() => {
  const err = (codice, dati) => Object.assign(new Error(codice), { dati: dati || {} });
  const b = document.getElementById('main');
  b.innerHTML = ['quota-esaurita', 'nessun-accesso', 'non-autenticato', 'chiave-mancante', 'modello']
    // Già tradotti da T() con i segnaposto: senza questo il giro sul DOM
    // creerebbe una seconda chiave con i numeri al posto dei nomi.
    .map((c) => '<p data-no-i18n>' + window.AI.messaggioErrore(err(c, { limite: 40 })) + '</p>').join('');
  window.__raccogli(b);
});

/* 7c. I due documenti, dentro e fuori dall'applicazione. */
for (const doc of ['privacy', 'ia']) {
  await page.evaluate((d) => { window.App.ctx.doc = d; window.App.go('privacy'); }, doc);
  await page.waitForTimeout(160);
  await raccogliVisibile();
  await page.evaluate((d) => {
    const l = document.getElementById('landing');
    l.classList.remove('hidden');
    l.innerHTML = window.UI.documenti({ doc: d }, true);
    window.__raccogli(l);
    l.classList.add('hidden');
  }, doc);
}
await page.evaluate(() => { window.App.ctx.aiBusy = true; window.App.render(); });
await page.waitForTimeout(160);
await raccogliVisibile();
await page.evaluate(() => { window.App.ctx.aiBusy = false; });

/* 8. Il modale del turno, nuovo e per ogni tipo di giornata. */
await page.evaluate(() => {
  const b = document.getElementById('modal-body');
  b.innerHTML = window.UI.shiftForm(null);
  window.__raccogli(b);
  ['lavoro', 'ferie', 'malattia', 'permesso', 'festivo', 'riposo'].forEach((tipo) => {
    b.innerHTML = window.UI.shiftForm({ id: 'x', date: window.Calc.today(), tipo, start: '09:00', end: '18:00', breakMin: 60 });
    window.__raccogli(b);
  });
});

/* 8b. La pagina di amministrazione. Qui nessuno è amministratore — il server
      non lo consentirebbe — quindi si disegna la vista con uno stato finto:
      serve a raccogliere le sue frasi, non a provarne i permessi. */
await page.evaluate(() => {
  const finto = { verificato: true, admin: true, motivo: 'ok', errore: null };
  const vero = window.Admin.stato;
  window.Admin.stato = () => finto;
  const c = {
    adminRuoli: [
      { codice: 'utente', etichetta: 'Utente', descrizione: 'base', quota_ia: 40, ia_illimitata: false, salta_abbonamento: false, amministratore: false, colore: 'neutro' },
      { codice: 'tester', etichetta: 'Tester', descrizione: 'prova le novità', quota_ia: 200, ia_illimitata: false, salta_abbonamento: true, amministratore: false, colore: 'info' },
      { codice: 'founder', etichetta: 'Founder', descrizione: 'senza limiti', quota_ia: null, ia_illimitata: true, salta_abbonamento: true, amministratore: false, colore: 'ok' },
    ],
    adminUtenti: [{ user_id: 'user_demo', turni: 12, checkin: 3, timbratura_aperta: true, ruoli: ['tester'], ia_mese: 12, ia_limite: 200, ultima_attivita: new Date().toISOString() }],
    adminDati: {
      userId: 'user_demo',
      shifts: [{ id: 's1', date: '2026-08-01', start_time: '09:00', end_time: '18:00', break_min: 60, tipo: 'lavoro', note: '' }],
      checkins: [{ id: 'c1', ts: Date.now(), score: 42, level: 'medio' }],
      settings: { data: { tema: 'dark' } },
      punch: { punch: null },
    },
  };
  const b = document.getElementById('main');
  // con dati, senza dati, e nello stato "non sei amministratore"
  b.innerHTML = window.UI.amministrazione(c);
  window.__raccogli(b);
  b.innerHTML = window.UI.amministrazione({ adminUtenti: [], adminDati: null, adminRuoli: [], adminEliminazioni: [] });
  window.__raccogli(b);
  // il registro delle eliminazioni, pieno
  b.innerHTML = window.UI.amministrazione(Object.assign({}, c, {
    adminEliminazioni: [
      { id: 1, user_id: 'user_x', email: 'tizio@example.com', motivo: 'Uso contrario alle condizioni.', eseguita_il: new Date().toISOString(), email_inviata: true },
      { id: 2, user_id: 'user_y', email: '', motivo: 'Richiesta della persona interessata.', eseguita_il: new Date().toISOString(), email_inviata: false },
    ],
  }));
  window.__raccogli(b);
  // il modulo di eliminazione, e i tre stati della scheda ruoli
  const m = document.getElementById('modal-body');
  m.innerHTML = window.UI.formEliminaUtente({ user_id: 'user_x', email: 'tizio@example.com' });
  window.__raccogli(m);
  b.innerHTML = window.UI.amministrazione(Object.assign({}, c, {
    adminDati: Object.assign({}, c.adminDati, { userId: 'user_demo' }),
    adminUtenti: [Object.assign({}, c.adminUtenti[0], { ruoli: ['admin'] })],
  }));
  window.__raccogli(b);
  window.__raccogli(b);
  b.innerHTML = window.UI.amministrazione({ adminUtenti: null, adminDati: null, adminErrore: 'Servizio di accesso non raggiungibile. Controlla la connessione e riprova.' });
  window.__raccogli(b);
  window.Admin.stato = () => ({ verificato: true, admin: false, motivo: 'non-admin', errore: null });
  b.innerHTML = window.UI.amministrazione({});
  window.__raccogli(b);
  window.Admin.stato = vero;
});

/* 9. I messaggi che non passano dal DOM: avvisi, conferme e le frasi già
      avvolte in T() nel sorgente. Si leggono dal codice, non dalla pagina. */
const ESCAPE = { n: '\n', t: '\t', r: '\r', "'": "'", '"': '"', '\\': '\\' };
const deEscape = (t) => t.replace(/\\(.)/g, (intero, c) => (c in ESCAPE ? ESCAPE[c] : intero));

const daSorgente = new Set();
for (const f of ['js/app.js', 'js/ui.js', 'js/geo.js', 'js/cloud.js', 'js/admin.js', 'js/ai.js']) {
  const codice = readFileSync(resolve(radice, f), 'utf8');
  for (const re of [/\btoast\(\s*'((?:[^'\\]|\\.)*)'/g, /\bT\(\s*'((?:[^'\\]|\\.)*)'/g, /confirm\(\s*'((?:[^'\\]|\\.)*)'/g]) {
    let m;
    // Le sequenze di escape vanno risolte: a runtime la stringa contiene un
    // a capo vero, non i due caratteri barra-n, e una chiave che li conserva
    // non combacerebbe mai.
    while ((m = re.exec(codice)) !== null) daSorgente.add(deEscape(m[1]));
  }
}

/* Non tutto ciò che è testo va tradotto. */
const ESCLUDI = [
  /^[\s{}\d%hm+\-–·/.,:()]*$/,          // solo numeri, unità e segni
  /^[\p{Emoji}\s]*(Italiano|English|Español|Français|Deutsch)$/u, // i nomi delle lingue restano nella loro lingua
  /^claude-/,                            // identificativi dei modelli
  /^(pk|sk|sb)_/,                        // chiavi
  /chiave Clerk:/,                       // riga diagnostica, composta a runtime
  /^https?:/,
  /^sk-ant-/,                            // segnaposto della chiave API
  /^Work Balance$/,                        // il nome del prodotto non si traduce
  /^mario\.rossi$/,                       // esempio di nome utente, non una frase
];

const chiavi = [...new Set([...(await page.evaluate(() => [...window.__chiavi])), ...daSorgente])];
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
const nonViste = precedenti.filter((k) => !elenco.includes(k));

/* L'elenco cresce, non si accorcia da solo. Se una passata non raggiunge uno
   stato — un ramo dei consigli, un mese senza dati — la sua frase non va
   persa insieme alla traduzione: sarebbe una regressione silenziosa, proprio
   quella che ha lasciato mezza applicazione in italiano. Per togliere davvero
   una chiave si usa --pota, che riscrive l'elenco con la sola passata. */
const pota = process.argv.includes('--pota');
const finale = pota ? elenco : [...new Set([...precedenti, ...elenco])].sort((a, b) => a.localeCompare(b, 'it'));

if (process.argv.includes('--verifica')) {
  if (nuove.length) console.error(`${nuove.length} chiavi nuove non ancora in _chiavi.json:\n  ` + nuove.join('\n  '));
  if (nonViste.length) console.error(`${nonViste.length} chiavi non incontrate in questa passata:\n  ` + nonViste.join('\n  '));
  if (!nuove.length) console.log(`${elenco.length} chiavi, nessuna novità.`);
  process.exit(nuove.length ? 1 : 0);
}

writeFileSync(USCITA, JSON.stringify(finale, null, 2) + '\n');
console.log(`${finale.length} chiavi in js/lang/_chiavi.json (${elenco.length} viste in questa passata)`);
if (nuove.length) console.log(`  ${nuove.length} nuove`);
if (nonViste.length) console.log(`  ${nonViste.length} non incontrate${pota ? ', rimosse' : ', conservate (usa --pota per toglierle)'}`);
