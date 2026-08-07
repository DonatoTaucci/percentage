/* Crea mobile/.env da .env.example se manca.
   Il file .env non è versionato (contiene la configurazione locale), quindi
   chi clona il repository non lo trova: questo script lo ricrea da solo,
   ed è agganciato a "npm install". */

import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = dirname(fileURLToPath(import.meta.url));
const mobile = resolve(qui, '..', 'mobile');
const env = resolve(mobile, '.env');
const modello = resolve(mobile, '.env.example');

if (existsSync(env)) {
  process.exit(0);
}

if (!existsSync(modello)) {
  console.warn('Manca mobile/.env.example: impossibile creare .env.');
  process.exit(0);
}

copyFileSync(modello, env);
console.log('Creato mobile/.env da .env.example.');

if (!/^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_(test|live)_/m.test(readFileSync(env, 'utf8'))) {
  console.log('Manca la publishable key di Clerk: node scripts/imposta-chiave-clerk.mjs pk_test_...');
}
