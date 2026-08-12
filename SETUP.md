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

### Il campo *Username* resta attivo

Nel pannello Clerk lo username è **attivo e obbligatorio**, e va bene così: entrambi i
client ora lo chiedono come ultimo passo della registrazione. Sul sito lo chiede la
finestra di Clerk; sull'app c'è una schermata dedicata, che compare sia dopo il codice
via email sia dopo l'accesso con Google, Apple o Facebook.

### ⚠️ Aggiungi l'email al token di Clerk — da fare tu

Serve alla pagina di amministrazione: il server riconosce l'amministratore dall'email
contenuta nel token, e Clerk **non la include di default**.

Pannello Clerk → **Sessions → Customize session token**, e aggiungi al JSON:

```json
{ "email": "{{user.primary_email_address}}" }
```

Senza questo passaggio la scheda **Admin** non compare, e la spiegazione del perché è
scritta nella pagina stessa. Non è un ripiego: se il token non porta l'email, il database
non ha modo di sapere chi sei, e concedere l'accesso sulla base di un controllo fatto nel
browser sarebbe una finta serratura.

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

### Il modulo di accesso resta sul sito

Il componente di Clerk è montato dentro la pagina con `routing: 'hash'`, non aperto come
finestra modale. La modale non ha un indirizzo proprio (il suo tipo è letteralmente
`SignInProps` senza le opzioni di routing), quindi i passaggi che hanno bisogno di un ritorno
— il rimbalzo di OAuth, la schermata *Fill in missing fields* quando Clerk chiede lo username —
finivano su `<dominio>.accounts.dev`, cioè fuori dal sito.

Con il frammento il componente si tiene i suoi passaggi in `#/...` e restiamo sul nostro
dominio anche a metà iscrizione. All'avvio, un frammento che inizia con `#/` viene interpretato
come iscrizione in corso e riapre il pannello: senza, chi torna da Google vedrebbe la
presentazione e perderebbe il passaggio. Uscendo, il frammento viene ripulito.

### Il nome utente lo chiediamo noi

Su Clerk, in **Configure → User & Authentication → Username**, la voce va lasciata
**disattivata** (o attiva ma *non* obbligatoria). Se resta obbligatoria, Clerk inserisce la
schermata *Fill in missing fields* dentro il proprio flusso di iscrizione, ed è quella che
portava su `accounts.dev`.

Il nome utente viene chiesto dopo l'accesso, da una schermata nostra, sul sito e nell'app, e
finisce nella colonna `username` di `profili`. È unico senza distinzione fra maiuscole e
minuscole (indice parziale `profili_username_unico`), e la convalida — lunghezza 3-20,
lettere, cifre, punto, trattino e trattino basso — sta nella funzione `imposta_username()`,
non nel modulo: un controllo nel browser dice cosa correggere, non impedisce di scrivere altro.

Chi non lo sceglie subito può rimandare: la domanda torna all'accesso successivo, e il nome si
cambia comunque da **Impostazioni → Account**.

> **In sviluppo resta la scritta "Development mode".** È la chiave `pk_test_…`: le pagine
> ospitate da Clerk (recupero password, profilo utente) continuano a stare su `accounts.dev`.
> Per toglierla del tutto serve un'istanza di produzione su Clerk con un dominio tuo, e la
> `pk_live_…` corrispondente in `js/config.js` — la publishable key è pubblica per costruzione,
> quindi lì ci sta bene.
>
> Con un'istanza di sviluppo, `<slug>.accounts.dev` **è** l'indirizzo dell'API di Clerk: durante
> l'accesso con Google il browser ci passa attraverso per forza, perché è lì che torna il
> rimbalzo OAuth. Non è una fuga di informazioni — quel dominio è già dedotto dalla publishable
> key, che sta nel sorgente della pagina — ma si vede, e in produzione al suo posto compare
> `clerk.tuodominio.it`. L'accesso via email e codice non ci passa mai.

### Amministrazione

`donatotaucci@gmail.com` è registrato come amministratore nella tabella `admins` del
database. Dopo aver aggiunto il claim `email`, entrando con quell'indirizzo compare la
scheda **Admin**, da cui si vedono e si modificano turni, check-in, impostazioni e
timbrature di **tutti** gli utenti.

Il permesso sta nelle policy per riga, non nel browser: chi non è amministratore, anche
forzando l'interfaccia, continua a ricevere dal server soltanto le proprie righe.
Verificato sul database simulando i token — un utente qualunque vede 1 riga su 2 e non
riesce a modificare quella altrui; l'amministratore le vede entrambe e può modificarle.

Per aggiungere o togliere amministratori si usa la tabella `admins` dal pannello
Supabase. Di proposito nessuno può promuoversi dall'applicazione.

L'elenco degli utenti viene dalla tabella `profili`, che ogni client scrive al proprio
accesso: gli account stanno su Clerk, e il database non ne saprebbe nulla finché quella
persona non sincronizza qualcosa. Chi si è registrato prima di questa modifica comparirà
al primo rientro.

### Assistente IA (Gemini) e quota

La conversazione della sezione Benessere non parte dal browser: la serve la Edge Function
`benessere-ia` del progetto Supabase, già distribuita. Perché risponda serve una cosa sola,
da fare una volta:

1. crea una chiave API su **aistudio.google.com** (progetto Google Cloud con fatturazione
   attiva se vuoi uscire dal piano gratuito);
2. nel pannello Supabase, **Edge Functions → benessere-ia → Secrets**, aggiungi
   `GEMINI_API_KEY` con quel valore. Opzionale: `GEMINI_MODEL` per cambiare modello senza
   toccare il codice (default `gemini-2.5-flash`).

Finché il secret manca la funzione risponde `chiave-mancante` e il sito lo dice per esteso
("il servizio non è ancora configurato"), invece di mostrare un errore generico.

La chiave non arriva mai al browser e il modello non è selezionabile dall'utente. Il token di
Clerk viene inoltrato al database, che lo verifica e ricava l'identità: la funzione ha
`verify_jwt` disattivato perché l'autorizzazione la fa PostgREST, nello stesso posto in cui
stanno già le policy per riga.

**Quota.** Ogni account ha 40 messaggi al mese. Il conteggio sta nella tabella `uso_ia`, che
nessun client può scrivere: la incrementa solo `consuma_credito_ia()`, dove controllo e
incremento sono la stessa istruzione. Per cambiare la quota di tutti basta modificare
`quota_ia` nella riga `utente` della tabella `ruoli`.

### Ruoli

La tabella `ruoli` è il catalogo: `codice`, `etichetta`, `descrizione` e i vantaggi
(`quota_ia`, `ia_illimitata`, `salta_abbonamento`, `amministratore`, `colore`, `ordine`).
Aggiungere un ruolo nuovo è una INSERT dal pannello Supabase; i vantaggi restano quelli
previsti, perché sono i soli che il codice sa applicare.

`utenti_ruoli` collega persone e ruoli, uno o più d'uno. Si assegnano dalla scheda **Admin**,
toccando il ruolo nella card dell'utente. Con più ruoli vale sempre il vantaggio migliore.

Un ruolo con `amministratore = true` dà accesso alla scheda Admin esattamente come la tabella
`admins`: le due strade convivono, quindi l'elenco storico continua a valere e i nuovi
amministratori si nominano dall'interfaccia.

### Eliminazione di un account dalla scheda Admin

Nella card di un utente c'è **Elimina questo account**. Il modulo chiede una motivazione
obbligatoria (almeno 10 caratteri) e la funzione `elimina-utente` fa tre cose in
quest'ordine: cancella le righe sul server e registra la motivazione, chiude l'account su
Clerk, invia alla persona un'email con la motivazione scritta parola per parola.

Non si può eliminare sé stessi (per quello c'è il pulsante nelle impostazioni) né un altro
amministratore: prima gli si toglie il ruolo. I due controlli sono nella funzione SQL, non
nell'interfaccia.

Servono altri tre secret sulla funzione `elimina-utente`:

| Secret | A cosa serve |
|---|---|
| `CLERK_SECRET_KEY` | chiudere l'account di accesso (`sk_live_…` o `sk_test_…` da dashboard.clerk.com → API keys) |
| `RESEND_API_KEY` | inviare l'email (resend.com) |
| `MITTENTE_EMAIL` | indirizzo del mittente, su un dominio verificato presso Resend |

Facoltativi: `MITTENTE_NOME` (default *Work Balance*) e `CONTATTO_EMAIL`, l'indirizzo a cui
la persona può rispondere per contestare.

> La **secret key di Clerk** vive qui e solo qui. Nel client non ci va mai — e infatti
> `scripts/imposta-chiave-clerk.mjs` si rifiuta di scriverla in `js/config.js`. Un secret di
> una Edge Function è un'altra cosa: sta sul server, non lo vede nessun browser.

**Senza dominio verificato l'email non parte.** Resend consente l'invio libero solo da un
dominio che hai verificato con i suoi record DNS; l'indirizzo di prova `onboarding@resend.dev`
scrive soltanto a te stesso. Finché manca, l'eliminazione avviene lo stesso e l'interfaccia
dice *"Account eliminato, ma l'email non è partita"* con il motivo: chi amministra sa che deve
scrivere a mano, invece di crederla partita.

Ogni eliminazione finisce nella tabella `eliminazioni`, visibile in fondo alla scheda Admin:
quando, chi, perché, e se l'email è partita. Conserva l'indirizzo anche dopo la cancellazione,
ed è dichiarato nell'informativa.

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
