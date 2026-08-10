/* Estrae dai sorgenti del sito le stringhe che l'utente legge davvero.

   Il criterio è volutamente prudente: meglio lasciare fuori una frase, che
   poi si aggiunge a mano, che avvolgere per errore un pezzo di marcatura o
   un nome di classe CSS e rompere la pagina. Restano quindi escluse le
   stringhe che contengono tag, uguali, parentesi graffe o che non hanno
   l'aspetto di una frase.

   Uso:  node scripts/estrai-stringhe.mjs [--json] */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = ['js/ui.js', 'js/app.js', 'js/geo.js', 'js/charts.js', 'js/coach.js'];

/* Una stringa è "da tradurre" se sembra testo per una persona. */
export function daTradurre(s) {
  if (s.length < 2) return false;
  if (/[<>]/.test(s)) return false;                  // marcatura
  if (/^[\s\d\W]*$/.test(s)) return false;           // solo simboli o numeri
  if (/^[a-z0-9-]+$/.test(s)) return false;          // identificatori, classi, chiavi
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return false;   // camelCase
  if (/[:;]\s*[\w-]+\s*(px|em|rem|%|;)/.test(s)) return false; // css inline
  if (/^(var|calc|rgba?|#[0-9a-f]{3,8})/i.test(s)) return false;
  if (/^\d{1,2}:\d{2}$/.test(s)) return false;       // orari
  if (!/[aeiouàèéìòù]/i.test(s)) return false;       // senza vocali non è una parola
  return /[A-Za-zÀ-ÿ]{2,}/.test(s);
}

/* Legge i letterali di stringa a apice singolo, gestendo gli escape. */
export function letterali(codice) {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'/g;
  let m;
  while ((m = re.exec(codice)) !== null) {
    // Salta ciò che sta dentro un commento di riga.
    const inizioRiga = codice.lastIndexOf('\n', m.index) + 1;
    const prima = codice.slice(inizioRiga, m.index);
    if (prima.includes('//')) continue;
    out.push({ grezzo: m[0], testo: m[1], indice: m.index });
  }
  return out;
}

export function raccogli() {
  const trovate = new Map();   // testo -> file in cui compare
  for (const f of FILE) {
    const codice = readFileSync(resolve(radice, f), 'utf8');
    for (const l of letterali(codice)) {
      if (!daTradurre(l.testo)) continue;
      if (!trovate.has(l.testo)) trovate.set(l.testo, new Set());
      trovate.get(l.testo).add(f);
    }
  }
  return trovate;
}

if (process.argv[1] && process.argv[1].endsWith('estrai-stringhe.mjs')) {
  const trovate = raccogli();
  const elenco = [...trovate.keys()].sort();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(elenco, null, 2));
  } else {
    for (const t of elenco) console.log(`${[...trovate.get(t)].join(',')}\t${t}`);
    console.error(`\n${elenco.length} stringhe distinte`);
  }
}
