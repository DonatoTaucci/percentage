# Percentage

Web app per registrare i turni di lavoro e le pause, calcolare la **percentuale di ore lavorate**
su giorno, settimana e mese tenendo conto degli **straordinari**, e monitorare il rischio di
**burnout, stress e ansia da lavoro** con una sezione dedicata.

Funziona su PC, Android e iPhone dallo stesso indirizzo: è una PWA installabile che gira anche
offline. Nessun account, nessun server: **i dati restano nel browser del dispositivo**.

---

## Cosa fa

**Turni e ore**
- Inserimento di turni con orario di inizio, fine e pausa pranzo; i turni a cavallo di mezzanotte
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
| Ore contrattuali al giorno | Base del monte ore previsto di settimana e mese |
| Giorni lavorativi | Quali giorni concorrono al previsto; lavorare fuori da questi conta tutto come straordinario |
| Soglia straordinario | Ore giornaliere oltre le quali scatta lo straordinario |
| Pausa predefinita / pausa retribuita | Valore proposto nel form e se la pausa conta come lavorata |
| Monte ore mensile fisso | Sostituisce il calcolo automatico quando il contratto prevede un monte ore mensile |
| Paga oraria e maggiorazione | Attivano la stima economica degli straordinari (indicativa) |

---

## Dati e privacy

- Tutto è salvato in `localStorage`: niente account, niente sincronizzazione, niente server.
- **Esporta un backup ogni tanto** (JSON) dalla sezione Impostazioni: cancellare i dati del browser
  cancella anche l'archivio. È disponibile anche l'esportazione CSV dei turni, utile come traccia
  degli straordinari.
- La chiave API dell'IA, se inserita, è salvata solo su quel dispositivo e usata per chiamare
  direttamente `api.anthropic.com`. All'IA vengono inviati il riepilogo aggregato dei turni e
  l'ultimo check-in — non i singoli turni né le note.

---

## Struttura

```
index.html              markup e navigazione
css/style.css           stile, tema scuro e chiaro
js/store.js             persistenza locale, import/export
js/calc.js              date, durate, percentuali, straordinari
js/charts.js            grafici SVG inline (nessuna libreria)
js/coach.js             questionario, indice di rischio, consigli
js/ai.js                integrazione opzionale con l'API di Claude
js/ui.js                rendering delle viste
js/app.js               avvio, routing, eventi
sw.js                   cache offline
manifest.webmanifest    installazione come app
tests/calcoli.test.js   test dei calcoli e del motore benessere
```

Nessun framework, nessuna build: si modifica un file e si ricarica la pagina.

## Test

```bash
python3 -m http.server 8765 &
npx playwright install chromium     # solo la prima volta
node tests/calcoli.test.js
```

Verifica durate dei turni (inclusi quelli notturni), straordinari, assenze, percentuali di periodo,
monte ore fisso, navigazione fra i mesi e le soglie del motore di rischio.
