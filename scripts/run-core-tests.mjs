/* Compila la logica pura in JavaScript e la esegue in Node.
   Non serve emulatore: i moduli di core non dipendono da React né dalle API native. */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const qui = dirname(fileURLToPath(import.meta.url));
const mobile = resolve(qui, '..', 'mobile');
const out = '/tmp/percentage-core-tests';

execSync('npx tsc -p tsconfig.test.json', { cwd: mobile, stdio: 'inherit' });
execSync(`node ${out}/tests/core.test.js`, { stdio: 'inherit' });
