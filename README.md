# Percentage

Timbra entrata e uscita, calcola la **percentuale di ore lavorate** su giorno, settimana e mese
tenendo conto degli **straordinari**, e monitora il rischio di **burnout, stress e ansia da lavoro**.

Il progetto è composto da tre parti che condividono lo stesso account e gli stessi dati:

| | | |
|---|---|---|
| **`mobile/`** | App nativa Expo (React Native) | Android e iPhone, pubblicabile su Play Store e App Store. Ha il **geofencing di sistema**: timbra da sola anche ad app chiusa |
| **radice del repo** | Sito web / PWA | Da PC, senza installare nulla |
| **Supabase + Clerk** | Server condiviso | Stesso account su telefono e computer: i turni sono gli stessi |

Entrambi i client sono **local-first**: funzionano offline e sincronizzano appena c'è rete.
Senza account restano perfettamente utilizzabili, solo senza condivisione fra dispositivi.

👉 **Prima configurazione: [SETUP.md](SETUP.md)** (server già pronto, manca la chiave Clerk).

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

**Benessere (prevenzione burnout)**
- Check-in di 16 domande su energia, sonno, recupero, carico, confini, ansia, motivazione e supporto.
- Indice di rischio 0-100 che **incrocia le risposte con i dati reali dei turni**: media settimanale,
  straordinari, giorni consecutivi senza riposo, pause saltate, giornate da 10+ ore, turni notturni,
  irregolarità del carico.
- Consigli pratici generati in base al profilo, ordinati per priorità, con un primo passo concreto.
- Storico dei check-in per vedere la direzione nel tempo.
- **Approfondimento opzionale con l'IA**: collegando una chiave API di Claude si sblocca una
  conversazione libera che ragiona sui propri numeri. Senza chiave l'analisi funziona comunque,
  perché è calcolata interamente sul dispositivo.

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
- La chiave API dell'IA, se inserita, è salvata solo su quel dispositivo e usata per chiamare
  direttamente `api.anthropic.com`. All'IA vengono inviati il riepilogo aggregato dei turni e
  l'ultimo check-in — non i singoli turni né le note.

---

## Struttura

```
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
js/ai.js                integrazione opzionale con l'API di Claude
js/config.js            chiavi pubbliche (Clerk, Supabase)
js/cloud.js             accesso Clerk e sincronizzazione (modulo ES separato)
js/ui.js                rendering delle viste
js/app.js               avvio, routing, eventi
sw.js                   cache offline
manifest.webmanifest    installazione come app
tests/calcoli.test.js   test dei calcoli e del motore benessere
tests/timbratura.test.js test della timbratura e della logica GPS
```

Nessun framework, nessuna build: si modifica un file e si ricarica la pagina.

## Test

```bash
# sito (42 test in un browser headless)
python3 -m http.server 8765 &
npx playwright install chromium     # solo la prima volta
node tests/calcoli.test.js
node tests/timbratura.test.js

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
