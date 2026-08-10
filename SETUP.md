# Configurazione

Tre pezzi: **server** (già fatto), **account Clerk** (fatto, manca solo il collegamento
a Supabase: [§2c](#2c-collega-clerk-a-supabase--da-fare-tu)), **pubblicazione dell'app**
sugli store.

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

## 2. Clerk

### 2a. Applicazione creata ✅

Applicazione di sviluppo `fleet-pigeon-30`, publishable key
`pk_test_ZmxlZXQtcGlnZW9uLTMwLmNsZXJrLmFjY291bnRzLmRldiQ`.

Controlla che in **User & Authentication → Email, Phone, Username** sia attivo
**Email address** con verifica **Email verification code**.

Sono attivi anche **Google, Apple e Facebook**, e ora funzionano su entrambi i client:
il sito usa il riquadro di Clerk, l'app i tre pulsanti in cima alla schermata di accesso.
In *Development mode* Clerk usa le proprie credenziali condivise per i provider social;
passando in produzione andranno registrate le app presso Google, Apple e Meta.

> **Nota per l'App Store.** Se un'app offre l'accesso con provider di terze parti, Apple
> richiede anche *Sign in with Apple*. Qui è offerto tramite browser: se in revisione
> chiedessero l'integrazione nativa, serve `expo-apple-authentication`.

### ⚠️ Disattiva il campo *Username* — da fare tu

Nel pannello Clerk, **User & Authentication → Username**, la voce risulta **attiva e
obbligatoria**. Percentage non usa nomi utente da nessuna parte, ma Clerk non può creare
l'account senza: entrando con Google la registrazione si ferma su *"Fill in missing
fields"* e chiede di inventarne uno.

Mettila su **off** (oppure *opzionale*). Fatto questo, l'accesso con Google, Apple o
Facebook si conclude in un passaggio solo.

Finché resta attiva: sul sito il campo viene chiesto dentro la finestra di Clerk, e
sull'app la registrazione non può concludersi — la schermata di accesso lo dice
esplicitamente invece di lasciar credere a un codice sbagliato.

### 2b. Chiave inserita ✅

È già in `js/config.js` (sito). Per l'app sta in `mobile/.env`, che non è versionato:
`npm install` lo crea da `.env.example`, poi

```bash
node scripts/imposta-chiave-clerk.mjs pk_test_ZmxlZXQtcGlnZW9uLTMwLmNsZXJrLmFjY291bnRzLmRldiQ
```

lo completa. Lo stesso comando riscrive anche `js/config.js`, ed è quello da usare il
giorno in cui passi a una chiave `pk_live_`. Rifiuta la secret key, se la incolli per
sbaglio.

> **Sulle due chiavi.** La *publishable key* è pubblica per costruzione: viaggia nel
> browser di chiunque usi un'applicazione Clerk, e da sola non dà accesso a nulla.
> La *secret key* (`sk_...`) è tutt'altra cosa: non serve a questo progetto, non va messa
> nel client e non va condivisa con nessuno.

### 2c. Collega Clerk a Supabase — da fare tu

Ultimo passaggio rimasto, e serve il tuo login: due clic, uno per pannello.

1. Apri **https://dashboard.clerk.com/setup/supabase** e segui la procedura guidata.
   Clerk configura da solo i propri token per Supabase — aggiunge il claim `role:
   authenticated`, che è quello che le policy del database si aspettano — e ti mostra il
   **Clerk domain**. Per questa applicazione è `fleet-pigeon-30.clerk.accounts.dev`.
2. Apri **https://supabase.com/dashboard/project/qshzkxqfoknbkajfreip/auth/third-party**,
   premi **Add provider**, scegli **Clerk** e incolla quel dominio.

Da quel momento Supabase verifica i token dell'utente e le policy per riga filtrano i dati
sull'id utente (`sub`). Prima di questo passaggio la sincronizzazione risponde con un errore
di autorizzazione, mentre app e sito continuano a funzionare in locale.

> **Non usare i "JWT templates".** Il vecchio metodo, che condivideva il JWT secret del
> progetto Supabase con Clerk, è deprecato da aprile 2025: condividere quel segreto è una
> cattiva pratica e ruotarlo comporta disservizi. La procedura sopra usa la verifica a
> chiave asimmetrica, che non richiede segreti condivisi.

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
| `js/config.js` | chiavi pubbliche del sito | sì, già complete |
| `mobile/.env` | chiavi pubbliche dell'app | **no**, è in .gitignore: lo crea `npm install` |
| `mobile/.env.example` | modello da copiare | sì |
| `mobile/eas.json` | profili di build e invio | sì |
| `mobile/app.json` | permessi, plugin, identificativi | sì |
