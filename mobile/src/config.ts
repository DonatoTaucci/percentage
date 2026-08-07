/* config.ts — chiavi pubbliche lette dall'ambiente.

   Sono tutte chiavi *pubblicabili*, pensate per stare nel client:
   - la publishable key di Clerk identifica l'applicazione, non l'utente;
   - la publishable key di Supabase dà accesso solo a ciò che le policy
     per riga permettono, e quelle richiedono un token Clerk valido.

   I valori stanno in mobile/.env (non versionato). Vedi .env.example. */

const env = process.env;

export const CLERK_PUBLISHABLE_KEY = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
export const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const CLERK_CONFIGURATO = CLERK_PUBLISHABLE_KEY.startsWith('pk_');
export const SERVER_CONFIGURATO = !!SUPABASE_URL && !!SUPABASE_KEY;

/** Con l'account l'app sincronizza; senza, resta perfettamente usabile in locale. */
export const SINCRONIZZAZIONE_DISPONIBILE = CLERK_CONFIGURATO && SERVER_CONFIGURATO;
