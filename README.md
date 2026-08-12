# Work Balance

Timbra entrata e uscita, calcola la **percentuale di ore lavorate** su giorno, settimana e mese
tenendo conto degli **straordinari**, e monitora il rischio di **burnout, stress e ansia da lavoro**.

Il progetto è composto da tre parti che condividono lo stesso account e gli stessi dati:

| | | |
|---|---|---|
| **`mobile/`** | App nativa Expo (React Native) | Android e iPhone, pubblicabile su Play Store e App Store. Ha il **geofencing di sistema**: timbra da sola anche ad app chiusa |
| **radice del repo** | Sito web / PWA | Da PC, senza installare nulla |
| **Supabase + Clerk** | Server condiviso | Stesso account su telefono e computer: i turni sono gli stessi |

Il **sito si apre su una pagina di presentazione** e richiede l'accesso per entrare
nell'applicazione. Chi è già entrato una volta su quel dispositivo può proseguire anche
quando il servizio di accesso non risponde: senza quella deroga un'app installabile e
utilizzabile offline smetterebbe di funzionare al primo problema di rete.

Il modulo di accesso è **montato dentro il sito** (routing a frammento), non in una finestra
modale: con la modale il componente non ha un indirizzo proprio, e ogni passaggio che ha
bisogno di un ritorno — il rimbalzo di OAuth, la schermata dei campi mancanti — atterrava sul
portale ospitato `<dominio>.accounts.dev`. Si finiva a completare l'iscrizione fuori dal sito,
su un indirizzo che l'utente non riconosce.

Entrambi i client sono **local-first**: funzionano offline e sincronizzano appena c'è rete.

L'interfaccia del sito è disponibile in **italiano, inglese, spagnolo, francese e tedesco**;
la lingua si cambia dal selettore in alto e resta memorizzata.

👉 **Prima configurazione: [SETUP.md](SETUP.md)** (server e chiavi già pronti, manca solo
il collegamento fra Clerk e Supabase).

---

## Cosa fa

**Timbratura**
- Funziona come un badge: un tocco su *Timbra entrata* avvia il cronometro, *Vai in pausa* la sospende,
  *Timbra uscita* chiude la giornata e la salva come turno.
- Durante il turno vedi ore lavorate in tempo reale, percentuale sul previsto e **ora di uscita stimata**
  per completare la giornata contrattuale.
- La timbratura sopravvive alla chiusura dell'app: se dimentichi di uscire la ritrovi aperta, con un avviso.
- Arrotondamento configurabile (al minuto, 5, 10, 15 o 30 minuti).
- In alternativa restano l'inserimento manuale e il tasto *Giornata standard*, che registra la giornata tipo in un tocco.

**Timbratura automatica con GPS** (opzionale)
- Salvi la posizione del posto di lavoro e un raggio: entrando nel raggio la timbratura parte da sola,
  uscendo si chiude, e ogni evento genera una notifica.
- Un'uscita dentro la **finestra della pausa pranzo** (ricavata dall'orario standard, con 75 minuti di
  tolleranza sui due lati) viene registrata come pausa e si chiude al rientro, invece di terminare il turno.
- Protezioni contro i falsi positivi: margine di isteresi in uscita, tempo di conferma configurabile
  (90 secondi di default) e letture GPS troppo imprecise scartate.
- Ogni automatismo può essere disattivato singolarmente (entrata, uscita, pausa, notifiche) e resta
  sempre correggibile a mano.

**Differenza fra app e sito, sul GPS:**

- **App nativa**: il geofencing lo fa il sistema operativo. iOS e Android sorvegliano l'area e
  risvegliano l'app quando entri o esci, **anche se l'app è chiusa**. Non serve tenerla aperta e
  non c'è un GPS sempre acceso a consumare batteria. Richiede il permesso *"Consenti sempre"*.
- **Sito**: un browser riceve la posizione solo mentre la pagina è aperta. Su Android il
  rilevamento prosegue in secondo piano finché il sistema non sospende la scheda; su iPhone
  Safari lo interrompe appena esci. Sul sito il GPS resta quindi un aiuto, non un automatismo:
  per la timbratura automatica vera conviene l'app.

**Turni e ore**
- Inserimento manuale di turni con orario di inizio, fine e pausa pranzo; i turni a cavallo di mezzanotte
  sono gestiti automaticamente.
- **Si può registrare anche un solo orario**, entrata o uscita, per chi si accorge dopo di aver
  dimenticato di timbrare. Il turno resta marcato *Da completare*, vale zero ore finché manca
  l'altro estremo — l'orario mancante non viene deciso al posto tuo, perché inventarlo
  falserebbe proprio le percentuali per cui esiste l'app — e il registro del mese dice quanti
  ne restano da sistemare. La possibilità è spiegata per esteso dentro il form di inserimento,
  perché una funzione che nessuno scopre è come se non ci fosse.
- Tipi di giornata: lavoro, ferie, permesso, malattia, festività, riposo. Le assenze retribuite
  contano come ore previste coperte (e coprono solo la parte di giornata non lavorata).
- Percentuale di ore lavorate **giornaliera, settimanale e mensile**. Per i periodi ancora in corso
  il confronto è con le ore previste **fino a oggi**, così la percentuale è leggibile anche il 3 del mese.
- **Straordinari**: ore oltre la soglia giornaliera impostata, più tutte le ore svolte in giorni non
  contrattuali. Stima economica opzionale con paga oraria e maggiorazione.
- Saldo ore (banca ore) positivo o negativo su ogni periodo.

**Statistiche**
- Andamento della percentuale nelle ultime 12 settimane.
- Riepilogo mensile dell'anno con ore lavorate, previste, percentuale, straordinari e saldo.
- Distribuzione delle ore medie per giorno della settimana.

**Ruoli** (solo sito)
- Catalogo in tabella (`ruoli`), non nel codice: aggiungere *beta*, *amico* o *collaboratore* è una
  riga, non un rilascio. I vantaggi invece sono colonne fisse — quota IA, IA illimitata, esenzione
  dall'abbonamento, permesso di amministrare — perché un vantaggio esiste solo se il codice lo applica.
- Di partenza: **Utente** (40 messaggi), **Tester** (200), **Amico** (100), **Founder** (illimitati),
  **Amministratore** (illimitati + accesso alla scheda Admin).
- Un utente può averne più d'uno e **vince sempre il vantaggio migliore**: assegnare un ruolo non
  può togliere niente.
- Si assegnano con un tocco dalla scheda Admin. La quota della beta gratuita per tutti si cambia
  modificando `quota_ia` della riga `utente`: nessun rilascio.

**Amministrazione** (solo sito)
- Scheda visibile agli amministratori, elencati nella tabella `admins` del database.
- Elenco degli utenti con email, nome utente, numero di turni, check-in, timbratura in corso
  e ultima attività. L'anagrafica si popola all'accesso: gli account vivono su Clerk, e senza
  una riga scritta al primo ingresso il database non saprebbe di chi si è registrato e basta.
- L'email mostrata è quella contenuta nel token, riscritta dal server con un trigger: un
  client può mentire su ciò che manda, non su come è firmato il proprio token.
- Per ciascuno: ruoli assegnabili con un tocco, turni modificabili riga per riga, check-in
  eliminabili, impostazioni e timbratura come JSON. L'elenco mostra ruoli e messaggi IA consumati
  nel mese.
- **Eliminazione di un account** con motivazione obbligatoria: cancella le righe sul server,
  chiude l'accesso su Clerk e invia alla persona un'email con la motivazione scritta parola
  per parola. Non si può eliminare sé stessi né un altro amministratore — prima gli si toglie
  il ruolo. Ogni eliminazione finisce in un registro con data, motivazione ed esito dell'invio.
- L'autorizzazione è nelle policy per riga del database, non nel browser: nascondere una
  scheda non impedisce di chiamare l'API, quindi il controllo che conta è sul server.
- Gli amministratori si aggiungono solo dal pannello Supabase: dall'applicazione nessuno
  può promuoversi.

**Lingua** (solo sito)
- Interfaccia in italiano, inglese, spagnolo, francese e tedesco, dal selettore in alto.
- Alla prima visita viene proposta la lingua del browser, se fra quelle disponibili.
- Nomi di mesi e giorni vengono dal sistema (`Intl`), non da un elenco tradotto a mano.
- Restano in italiano i testi lunghi dei consigli anti-burnout; l'assistente IA risponde
  nella lingua dell'interfaccia.
- Tradotte anche l'informativa privacy e la nota sull'IA, per intero.

**Benessere (prevenzione burnout)**
- Check-in di 16 domande su energia, sonno, recupero, carico, confini, ansia, motivazione e supporto.
- Indice di rischio 0-100 che **incrocia le risposte con i dati reali dei turni**: media settimanale,
  straordinari, giorni consecutivi senza riposo, pause saltate, giornate da 10+ ore, turni notturni,
  irregolarità del carico.
- Consigli pratici generati in base al profilo, ordinati per priorità, con un primo passo concreto.
- Storico dei check-in per vedere la direzione nel tempo.
- **Approfondimento opzionale con l'IA**: una conversazione libera che ragiona sui propri numeri.
  Gira su **Gemini 2.5 Flash**, chiamato da una Edge Function di Supabase: la chiave sta nei secret
  del server, non esiste sul dispositivo di nessuno e il modello non è selezionabile. In beta è
  gratuita, con **40 messaggi al mese** per account — quota alzabile con i ruoli. L'analisi di base
  funziona comunque, perché è calcolata interamente sul dispositivo.

> La sezione benessere è uno strumento di auto-osservazione, non uno strumento diagnostico.
> In caso di malessere intenso o prolungato il riferimento resta il medico di base, uno psicologo
> o il medico competente aziendale.

---

## Come si usa

### In locale

Serve un server statico qualsiasi (i service worker non funzionano da `file://`):

```bash
python3 -m http.server 8080
# poi apri http://localhost:8080
```

### Online

Il progetto è composto solo da file statici: basta pubblicare la cartella su GitHub Pages,
Netlify, Vercel o qualunque hosting statico. Nessuna build, nessuna dipendenza.

Per GitHub Pages: *Settings → Pages → Deploy from a branch*, scegliere il branch e la cartella `/`.

### Lavorare sulle traduzioni

```bash
npm run chiavi            # rilegge le frasi rendendo ogni schermata in Chromium
npm run chiavi:verifica   # esce con errore se ci sono frasi nuove o sparite
npm run lingue            # copertura dei dizionari e coerenza dei segnaposto
npm run legale            # informativa del sito e dell'app allineate frase per frase
```

Le chiavi sono i testi italiani (`js/lang/_chiavi.json`), i dizionari stanno in `js/lang/`.
Cambiare una frase italiana invalida le sue traduzioni: `npm run chiavi:verifica` lo segnala.

### Installazione sul telefono

- **Android (Chrome)**: menu ⋮ → *Aggiungi a schermata Home*, oppure il pulsante ⤓ nella barra dell'app.
- **iPhone (Safari)**: pulsante Condividi → *Aggiungi a Home*.
- **PC (Chrome/Edge)**: icona di installazione nella barra degli indirizzi.

---

## Configurazione

In **Impostazioni** si definiscono:

| Voce | Effetto |
|---|---|
| **Orario standard** (inizio, pausa da/a, fine) | È la fonte di verità: da qui l'app ricava le ore contrattuali giornaliere, precompila i turni manuali e riconosce la finestra della pausa pranzo per il GPS. Es. 9:00–18:00 con pausa 13:00–14:00 → giornata da 8 h |
| Giorni lavorativi | Quali giorni concorrono al previsto; lavorare fuori da questi conta tutto come straordinario |
| Soglia straordinario | Ore giornaliere oltre le quali scatta lo straordinario (segue le ore contrattuali finché non la modifichi) |
| Arrotondamento timbratura | Al minuto oppure a 5/10/15/30 minuti |
| Pausa retribuita | Se attiva, la pausa conta come tempo lavorato |
| Monte ore mensile fisso | Sostituisce il calcolo automatico quando il contratto prevede un monte ore mensile |
| Paga oraria e maggiorazione | Attivano la stima economica degli straordinari (indicativa) |
| Posizione, raggio e conferma (GPS) | Parametri della timbratura automatica |

---

## Dati e privacy

Il progetto ha un'**informativa privacy** e una **nota sull'intelligenza artificiale** scritte per
essere lette: raggiungibili dalla presentazione (prima di creare un account, che è il momento in cui
la decisione si prende), dalle Impostazioni del sito e dalla schermata Privacy dell'app.

Il testo è uno solo per i due client — `js/legale.js` per il sito, `mobile/src/core/legale.ts` per
l'app — e `node scripts/controlla-legale.mjs` confronta le due copie frase per frase: un documento
legale che dice due cose diverse a seconda del client sarebbe peggio di nessun documento.

**Consensi.** Due trattamenti sono spenti in partenza e non partono senza un atto esplicito:

- il **questionario sul benessere**, perché le risposte riguardano la salute (art. 9 GDPR): senza
  consenso il questionario non si apre, quindi quei dati non nascono proprio;
- la **conversazione con l'IA**: senza consenso non parte nessuna richiesta, e il controllo è nel
  modulo che invia, non solo nel pannello che si nasconde.

Il consenso si toglie con lo stesso interruttore con cui si dà, e viaggia con le impostazioni:
darlo dal telefono vale anche sul sito, revocarlo revoca ovunque. Viene salvata la data.

**Diritti esercitabili senza chiedere niente a nessuno:** esportazione in JSON e CSV (portabilità),
modifica di qualsiasi dato (rettifica), *Elimina account e dati* (cancellazione) che rimuove le
righe sul server, l'archivio locale e l'account Clerk — in quest'ordine, perché chiuso l'account il
token non vale più e le righe resterebbero senza nessuno autorizzato a toglierle.

**Trasparenza sull'IA.** L'indice di rischio e i consigli non sono IA: sono regole fisse eseguite sul
dispositivo, e a parità di dati danno sempre lo stesso risultato. L'unica parte con un modello è la
conversazione facoltativa, dichiarata come tale prima di scriverci e con ogni risposta marcata
*Generato dall'IA*. La nota dichiara anche l'uso **non** previsto: Work Balance è uno strumento
personale del lavoratore, non un sistema di monitoraggio o valutazione a disposizione del datore di
lavoro — impiego che ricadrebbe fra i sistemi ad alto rischio dell'AI Act.

- Senza account nulla esce dal dispositivo: `localStorage` sul sito, archivio locale nell'app.
- Con l'account, turni, check-in e impostazioni vengono sincronizzati sul progetto Supabase.
  Ogni riga è filtrata per utente (Row Level Security): la chiave pubblica da sola non legge nulla,
  serve un token valido di Clerk.
- Uscendo dall'account i dati locali del dispositivo vengono rimossi; quelli sul server restano
  e si ritrovano al prossimo accesso.
- Le coordinate del posto di lavoro restano sul dispositivo: non vengono inviate da nessuna parte,
  e il confronto con la posizione attuale avviene interamente nel browser.
- **Esporta un backup ogni tanto** (JSON) dalla sezione Impostazioni: cancellare i dati del browser
  cancella anche l'archivio. È disponibile anche l'esportazione CSV dei turni, utile come traccia
  degli straordinari.
- **La chiave dell'IA non esiste sul client.** La conversazione passa da una Edge Function di
  Supabase che tiene la chiave nei suoi secret, aggiunge le istruzioni per il modello e conta la
  quota mensile. Al modello vengono inviati il riepilogo aggregato dei turni e l'ultimo check-in —
  non i singoli turni, non le note, non email o nome utente. Il testo della conversazione non viene
  conservato da nessuna parte.
- La quota è contata dal database con una funzione `security definer`: il controllo e l'incremento
  stanno nella stessa istruzione, così due richieste in parallelo non passano entrambe.

---

## Struttura

```
supabase/functions/     benessere-ia (conversazione) ed elimina-utente (chiusura account)
mobile/                 app nativa Expo (React Native + TypeScript)
  app/                  schermate: accesso, Oggi, Turni, Statistiche, Benessere, Impostazioni
  src/core/             logica pura: calcoli, timbratura, decisioni GPS, motore benessere
  src/data/             persistenza locale e sincronizzazione con il server
  src/services/         geofencing di sistema e notifiche
  src/ui/               tema, componenti e grafici SVG
  tests/core.test.ts    45 test della logica, eseguibili senza emulatore

index.html              sito: markup e navigazione
css/style.css           stile, tema scuro e chiaro
js/store.js             persistenza locale, import/export
js/calc.js              date, durate, percentuali, straordinari
js/charts.js            grafici SVG inline (nessuna libreria)
js/coach.js             questionario, indice di rischio, consigli
js/geo.js               timbratura automatica GPS e notifiche
js/ai.js                client della funzione sul server: riepilogo, quota, errori
js/i18n.js              traduzione dell'interfaccia
js/lang/                dizionari e elenco delle chiavi
js/legale.js            informativa privacy e nota sull'IA
js/admin.js             lettura e modifica dei dati dalla pagina di amministrazione
js/config.js            chiavi pubbliche (Clerk, Supabase)
js/cloud.js             accesso Clerk e sincronizzazione (modulo ES separato)
js/ui.js                rendering delle viste
js/app.js               avvio, routing, eventi
sw.js                   cache offline
manifest.webmanifest    installazione come app
tests/calcoli.test.js   test dei calcoli e del motore benessere
tests/timbratura.test.js test della timbratura e della logica GPS
tests/privacy.test.js   test dei consensi e della trasparenza sull'IA
tests/eliminazione.test.js test dell'eliminazione di un account
tests/accesso.test.js   test del modulo di accesso montato in pagina
```

Nessun framework, nessuna build: si modifica un file e si ricarica la pagina.

## Test

```bash
# sito (82 test in un browser headless)
python3 -m http.server 8765 &
npx playwright install chromium     # solo la prima volta
node tests/calcoli.test.js
node tests/timbratura.test.js
node tests/privacy.test.js
node tests/eliminazione.test.js
node tests/accesso.test.js

# app (45 test della logica pura, senza emulatore)
cd mobile && npm test
npm run typecheck
```

`calcoli.test.js` verifica durate dei turni (inclusi quelli notturni), straordinari, assenze,
percentuali di periodo, monte ore fisso, navigazione fra i mesi e le soglie del motore di rischio.

`timbratura.test.js` verifica il ciclo entrata/pausa/uscita, l'arrotondamento, le ore contrattuali
derivate dall'orario standard e la macchina a stati del geofence: arrivo, uscita a pranzo, rientro,
uscita finale, isteresi, letture imprecise, tempo di conferma e automatismi disattivati.

`mobile/tests/core.test.ts` copre gli stessi calcoli sull'app più le decisioni prese dal task di
geofencing quando il sistema la sveglia: arrivo, uscita a pranzo, rientro, uscita finale e i casi
con gli automatismi disattivati.
