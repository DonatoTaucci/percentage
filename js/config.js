/* config.js — chiavi pubbliche del sito.

   Sono chiavi "publishable", pensate per stare nel client:
   - quella di Clerk identifica l'applicazione, non l'utente;
   - quella di Supabase dà accesso solo a ciò che le policy per riga
     consentono, e quelle richiedono un token Clerk valido.

   Senza la chiave di Clerk il sito funziona lo stesso, in locale:
   perde solo la sincronizzazione con l'app. */
window.CONFIG = {
  // Incolla qui la publishable key creata su dashboard.clerk.com (pk_test_... o pk_live_...)
  CLERK_PUBLISHABLE_KEY: '',

  // Progetto Supabase "percentage", già creato e configurato
  SUPABASE_URL: 'https://qshzkxqfoknbkajfreip.supabase.co',
  SUPABASE_KEY: 'sb_publishable_aX6z5dwM_7NlRc4t6DK9Kg_U0Sa8xFP'
};
