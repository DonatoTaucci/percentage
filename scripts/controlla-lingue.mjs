/* Confronta i dizionari con l'elenco di chiavi raccolto dalle schermate.

   Segnala tre cose, in ordine di gravità:
   - chiavi mancanti: l'utente vedrà quella frase in italiano;
   - chiavi di troppo: traduzioni di testi che non esistono più;
   - segnaposto discordanti: {0} presente nell'originale e assente nella
     traduzione (o viceversa), che a video diventa un buco o un numero perso.

   Uso:  node scripts/controlla-lingue.mjs */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LINGUE = ['en', 'es', 'fr', 'de'];

const chiavi = JSON.parse(readFileSync(resolve(radice, 'js/lang/_chiavi.json'), 'utf8'));

/* I dizionari sono file per il browser: li eseguiamo con un window finto. */
function leggi(code) {
  const percorso = resolve(radice, `js/lang/${code}.js`);
  if (!existsSync(percorso)) return null;
  const finestra = { I18N: {} };
  new Function('window', readFileSync(percorso, 'utf8'))(finestra);
  return finestra.I18N[code] || null;
}

const segnaposti = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');

let problemi = 0;
for (const code of LINGUE) {
  const d = leggi(code);
  if (!d) { console.error(`${code}: dizionario assente`); problemi++; continue; }

  const mancanti = chiavi.filter((k) => !(k in d));
  const extra = Object.keys(d).filter((k) => !chiavi.includes(k));
  const discordanti = chiavi
    .filter((k) => k in d && segnaposti(k) !== segnaposti(d[k]))
    .map((k) => `${k}\n        → ${d[k]}`);

  const tradotte = chiavi.length - mancanti.length;
  const stato = mancanti.length || extra.length || discordanti.length ? '✗' : '✓';
  console.log(`${stato} ${code}: ${tradotte}/${chiavi.length}`);

  if (mancanti.length) { console.log(`    mancanti (${mancanti.length}):`); mancanti.forEach((k) => console.log('      ' + k)); }
  if (extra.length) { console.log(`    non più usate (${extra.length}):`); extra.forEach((k) => console.log('      ' + k)); }
  if (discordanti.length) { console.log(`    segnaposto discordanti (${discordanti.length}):`); discordanti.forEach((k) => console.log('      ' + k)); }

  problemi += mancanti.length + extra.length + discordanti.length;
}

process.exit(problemi ? 1 : 0);
