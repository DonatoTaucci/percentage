# Configurazione

Tre pezzi: **server** (già fatto), **account Clerk** (10 minuti, serve il tuo login),
**pubblicazione dell'app** sugli store.

---

## 1. Server — già configurato ✅

Progetto Supabase `percentage`, regione Francoforte, piano gratuito.

| | |
|---|---|
| URL | `https://qshzkxqfoknbkajfreip.supabase.co` |
| Publishable key | `sb_publishable_aX6z5dwM_7NlRc4t6DK9Kg_U0Sa8xFP` |
| Tabelle | `shifts`, `checkins`, `settings`, `punches` |

Le chiavi sono già scritte in `js/config.js` (sito) e `mobile/.env.example` (app).
Sono chiavi *publishable*: possono stare nel client perché ogni tabella ha
Row Level Security e ogni riga è filtrata sull'identità che arriva da Clerk.
Senza un token valido, quella chiave non legge nulla.

---

## 2. Clerk — da fare tu

Serve il tuo account: non posso crearlo io.

1. Vai su **https://dashboard.clerk.com** e crea un'applicazione, per esempio `Percentage`.
2. In **User & Authentication → Email, Phone, Username**: lascia attivo **Email address**
   e come metodo di verifica **Email verification code**. L'app usa il codice via email,
   quindi non servono password.
3. In **API Keys** copia la **Publishable key** (inizia con `pk_test_` o `pk_live_`).
   La *Secret key* non serve a nulla qui e non va condivisa.
4. Incolla la publishable key in due punti:

   **Sito** — `js/config.js`:
   ```js
   CLERK_PUBLISHABLE_KEY: 'pk_test_...',
   ```

   **App** — `mobile/.env` (copia `mobile/.env.example` se non esiste):
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

### 2b. Collegare Clerk a Supabase

Perché il server accetti i token di Clerk:

1. Nel **dashboard Clerk** apri **Configure → Sessions → JWT templates** e crea (o verifica)
   l'integrazione **Supabase**. Clerk mostra il **Clerk domain** (qualcosa come
   `https://tuo-nome.clerk.accounts.dev`).
2. Nel **dashboard Supabase** del progetto `percentage`, vai in
   **Authentication → Sign In / Providers → Third-Party Auth**, aggiungi **Clerk**
   e incolla il **Clerk domain**.

Da quel momento il token dell'utente viene verificato da Supabase e le policy per riga
filtrano i dati sull'id utente (`sub`). Fino a quel momento la sincronizzazione risponderà
con un errore di autorizzazione, mentre app e sito continuano a funzionare in locale.

### Come verificare che funzioni

1. Apri il sito, **Impostazioni → Account → Accedi**, inserisci la tua email e il codice.
2. Registra un turno.
3. Apri l'app sul telefono, accedi con **la stessa email**: il turno deve comparire.

---

## 3. App — dallo sviluppo agli store

### Provare subito (senza store)

```bash
cd mobile
npm install
npx expo start
```

> ⚠️ **Il geofencing in background non funziona in Expo Go.** Per provarlo serve una
> build di sviluppo:
> ```bash
> npx eas build --profile development --platform android
> ```

### Prerequisiti per la pubblicazione

```bash
npm install -g eas-cli
eas login                 # account Expo (gratuito)
eas init                  # collega il progetto e riempie extra.eas.projectId in app.json
```

Poi aggiungi la chiave Clerk fra i segreti di build, così finisce nelle build senza stare nel repository:

```bash
eas secret:create --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_...
```

### Google Play

1. Account sviluppatore Google Play (25 $ una tantum).
2. Build e invio:
   ```bash
   eas build --platform android --profile production
   eas submit --platform android
   ```
3. Nella scheda dell'app dichiara l'uso della **posizione in background**: Google chiede
   una motivazione scritta e un breve video che mostra la funzione. La motivazione è
   *"timbratura automatica di entrata e uscita dal luogo di lavoro"*: è un caso d'uso
   ammesso, ma va dichiarato o l'app viene respinta.

### App Store

1. Apple Developer Program (99 €/anno).
2. Build e invio:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios
   ```
3. In App Store Connect spiega perché serve la posizione "Sempre". Le stringhe mostrate
   all'utente sono già in `app.json` e dicono esattamente a cosa serve.

### Identificativi

Sono in `app.json` e vanno cambiati se pubblichi con un altro account:

```json
"ios":     { "bundleIdentifier": "com.donatotaucci.percentage" }
"android": { "package": "com.donatotaucci.percentage" }
```

---

## 4. Sito — pubblicazione

Solo file statici, nessuna build:

- **GitHub Pages**: *Settings → Pages → Deploy from a branch*, cartella `/`.
- **Netlify / Vercel**: trascina la cartella, oppure collega il repository.

Serve **https** (tutti e tre lo danno di default): senza, il browser blocca GPS e notifiche.

---

## Riepilogo dei file di configurazione

| File | Contiene | Nel repository |
|---|---|---|
| `js/config.js` | chiavi pubbliche del sito | sì (chiave Clerk da riempire) |
| `mobile/.env` | chiavi pubbliche dell'app | **no**, è in .gitignore |
| `mobile/.env.example` | modello da copiare | sì |
| `mobile/eas.json` | profili di build e invio | sì |
| `mobile/app.json` | permessi, plugin, identificativi | sì |
