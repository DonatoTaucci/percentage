/* Confronta l'informativa del sito con quella dell'app, frase per frase.

   Sono due file separati perché il sito è JavaScript globale senza build e
   l'app è TypeScript con moduli: nessuno dei due può importare l'altro. Ma
   un documento legale che dice due cose diverse a seconda del client è
   peggio di un documento solo, quindi la copia va tenuta onesta da qualcosa
   che non sia la memoria di chi lo modifica.

   Uso:  node scripts/controlla-legale.mjs */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Il sito: si esegue con un window finto e si legge quello che registra. */
function daSito() {
  const finestra = {};
  new Function('window', readFileSync(resolve(radice, 'js/legale.js'), 'utf8'))(finestra);
  const L = finestra.Legale;
  return { informativa: L.INFORMATIVA, notaIA: L.NOTA_IA, contatto: L.contatto, aggiornata: L.aggiornata };
}

/* L'app: i due documenti sono letterali JSON dentro il TypeScript, quindi si
   ritagliano e si leggono senza compilare niente. */
function daApp() {
  const src = readFileSync(resolve(radice, 'mobile/src/core/legale.ts'), 'utf8');
  const oggetto = (nome) => {
    const inizio = src.indexOf(`export const ${nome}: Documento = `);
    if (inizio < 0) throw new Error(`${nome} non trovato in mobile/src/core/legale.ts`);
    const apertura = src.indexOf('{', inizio);
    let profondita = 0;
    for (let i = apertura; i < src.length; i++) {
      if (src[i] === '{') profondita++;
      else if (src[i] === '}') {
        profondita--;
        if (profondita === 0) return JSON.parse(src.slice(apertura, i + 1));
      }
    }
    throw new Error(`${nome}: parentesi non chiusa`);
  };
  const costante = (nome) => (src.match(new RegExp(`export const ${nome} = '([^']*)'`)) || [])[1];
  return {
    informativa: oggetto('INFORMATIVA'),
    notaIA: oggetto('NOTA_IA'),
    contatto: costante('CONTATTO'),
    aggiornata: costante('AGGIORNATA'),
  };
}

/* Tutte le frasi di un documento, in ordine: è il confronto che conta. */
function frasi(doc) {
  const out = [doc.titolo, ...doc.intro];
  for (const s of doc.sezioni) {
    out.push(s.titolo, ...(s.paragrafi || []), ...(s.voci || []), ...(s.coda || []));
  }
  return out;
}

const sito = daSito();
const app = daApp();
let problemi = 0;

for (const [nome, a, b] of [
  ['informativa', frasi(sito.informativa), frasi(app.informativa)],
  ['nota sull\'IA', frasi(sito.notaIA), frasi(app.notaIA)],
]) {
  const soloSito = a.filter((t) => !b.includes(t));
  const soloApp = b.filter((t) => !a.includes(t));
  const ordine = a.length === b.length && a.every((t, i) => t === b[i]);

  if (!soloSito.length && !soloApp.length && ordine) {
    console.log(`✓ ${nome}: ${a.length} frasi identiche`);
    continue;
  }
  console.log(`✗ ${nome}: sito ${a.length} frasi, app ${b.length}`);
  soloSito.forEach((t) => console.log('    solo nel sito: ' + t.slice(0, 90)));
  soloApp.forEach((t) => console.log('    solo nell\'app: ' + t.slice(0, 90)));
  if (!soloSito.length && !soloApp.length) console.log('    stesse frasi, ordine diverso');
  problemi++;
}

for (const campo of ['contatto', 'aggiornata']) {
  if (sito[campo] !== app[campo]) {
    console.log(`✗ ${campo}: sito "${sito[campo]}", app "${app[campo]}"`);
    problemi++;
  }
}

process.exit(problemi ? 1 : 0);
