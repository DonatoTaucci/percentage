/* Scrive la publishable key di Clerk nei due punti che la usano:
   il sito (js/config.js) e l'app (mobile/.env).

   Uso:  node scripts/imposta-chiave-clerk.mjs pk_test_xxxxx

   La publishable key è pubblica per costruzione: viaggia nel client di
   qualunque applicazione Clerk. La *secret key* (sk_...) non serve a
   questo progetto e non va messa da nessuna parte nel client. */

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = dirname(fileURLToPath(import.meta.url));
const radice = resolve(qui, '..');

const chiave = (process.argv[2] || '').trim();

if (!chiave) {
  console.error('Uso: node scripts/imposta-chiave-clerk.mjs pk_test_...');
  process.exit(1);
}

if (chiave.startsWith('sk_')) {
  console.error('Questa è la SECRET key: non va messa nel client e non serve a questo progetto.');
  console.error('Serve la publishable key, che inizia con pk_test_ o pk_live_.');
  process.exit(1);
}

if (!/^pk_(test|live)_[A-Za-z0-9$_\-./=]+$/.test(chiave)) {
  console.error('Formato non riconosciuto: la publishable key inizia con pk_test_ o pk_live_.');
  process.exit(1);
}

/* --- sito --- */
const configJs = resolve(radice, 'js', 'config.js');
const sito = readFileSync(configJs, 'utf8');
const riga = /CLERK_PUBLISHABLE_KEY:\s*'[^']*'/;
if (!riga.test(sito)) {
  console.error('Non ho trovato CLERK_PUBLISHABLE_KEY in js/config.js: controlla il file.');
  process.exit(1);
}
writeFileSync(configJs, sito.replace(riga, `CLERK_PUBLISHABLE_KEY: '${chiave}'`));

/* --- app --- */
const envPath = resolve(radice, 'mobile', '.env');
if (!existsSync(envPath)) {
  copyFileSync(resolve(radice, 'mobile', '.env.example'), envPath);
}
let app = readFileSync(envPath, 'utf8');
if (/^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=.*$/m.test(app)) {
  app = app.replace(/^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=.*$/m, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=${chiave}`);
} else {
  app += `\nEXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=${chiave}\n`;
}
writeFileSync(envPath, app);

const ambiente = chiave.startsWith('pk_live_') ? 'produzione' : 'sviluppo';
console.log(`Chiave di ${ambiente} scritta in:`);
console.log('  js/config.js      (sito)');
console.log('  mobile/.env       (app)');
console.log('');
console.log('Restano due passaggi nei pannelli, che richiedono il tuo login:');
console.log('  1. https://dashboard.clerk.com/setup/supabase   (configura Clerk per Supabase)');
console.log('  2. https://supabase.com/dashboard/project/qshzkxqfoknbkajfreip/auth/third-party');
console.log('     → Add provider → Clerk → incolla il Clerk domain mostrato al passo 1');
console.log('');
console.log('Poi riavvia l\'app con: cd mobile && npx expo start -c');
