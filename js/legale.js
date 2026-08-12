/* legale.js — informativa privacy e nota sull'intelligenza artificiale.

   Il testo sta qui, fuori da ui.js, per due ragioni pratiche: si aggiorna
   con una cadenza tutta sua (cambia un fornitore, cambia la data in fondo)
   e va tradotto come tutto il resto dell'interfaccia.

   È scritto come dati, non come HTML, perché lo stesso testo esiste anche
   nell'app (mobile/src/core/legale.ts) e due documenti legali che divergono
   sono peggio di uno solo. `node scripts/controlla-legale.mjs` confronta le
   due copie frase per frase e fallisce se si allontanano.

   Regola di scrittura, per la traduzione: dentro un paragrafo niente
   grassetti o tag in mezzo alla frase. Il traduttore lavora su nodi di
   testo, e uno <strong> a metà periodo spezza la frase in due chiavi che
   nessuna lingua rimetterebbe insieme nello stesso ordine. */
(function (global) {
  'use strict';

  /* Data dell'ultimo aggiornamento sostanziale. Va cambiata a mano quando
     cambia il contenuto: è ciò che permette a chi legge di capire se sta
     guardando la stessa versione di prima. */
  var AGGIORNATA = '2026-08-11';
  var CONTATTO = 'donatotaucci@gmail.com';

  var INFORMATIVA = {
    titolo: 'Informativa sul trattamento dei dati personali',
    intro: [
      'In breve: i turni li scrivi tu e restano tuoi. Sul dispositivo sempre, sul server solo se accedi con un account, per poterli ritrovare sull\'altro dispositivo.',
      'Non c\'è nessuna pubblicità, nessun tracciamento, nessuna statistica di navigazione e nessun dato venduto a terzi.',
      'Le due cose delicate — il questionario sul benessere e la conversazione con l\'intelligenza artificiale — sono facoltative, spente in partenza e si accendono solo se lo chiedi tu.'
    ],
    sezioni: [
      {
        titolo: 'Chi tratta i dati',
        paragrafi: [
          'Il titolare del trattamento è Donato Taucci, che sviluppa e mette a disposizione questa applicazione.',
          'Per qualsiasi richiesta relativa ai dati personali, compreso l\'esercizio dei diritti descritti più avanti, il recapito è donatotaucci@gmail.com.',
          'Se stai usando Work Balance su indicazione del tuo datore di lavoro, per i dati che il datore di lavoro ti chiede di registrare il titolare è lui, e questa informativa va letta insieme a quella che ti ha fornito.'
        ]
      },
      {
        titolo: 'Quali dati vengono trattati',
        paragrafi: [
          'Dati dell\'account, quando accedi: indirizzo email, nome utente scelto da te e un identificativo interno. Servono a riconoscerti e a legare i tuoi turni al tuo account.',
          'Dati di lavoro, che inserisci tu: date e orari di entrata e uscita, pause, tipo di giornata, note libere, timbrature in corso e le impostazioni del tuo orario contrattuale.',
          'Dati sul benessere, solo se compili il questionario: le risposte sulle tue condizioni di stress, sonno, energia e ansia legata al lavoro, e il punteggio che ne deriva. Sono dati che riguardano la salute e per questo hanno un trattamento a parte, descritto sotto.',
          'Dati di posizione, solo se attivi il rilevamento: le coordinate del luogo di lavoro che salvi tu e la posizione del dispositivo mentre il rilevamento è acceso. Servono a capire se sei dentro o fuori dall\'area e restano sul dispositivo: non vengono inviate né conservate sul server.',
          'Dati tecnici necessari al funzionamento: i registri del fornitore del database e dell\'hosting, che includono indirizzo IP e ora della richiesta come in qualsiasi servizio su internet.',
          'Non vengono raccolti dati di navigazione a fini statistici o pubblicitari, non ci sono cookie di profilazione e non c\'è nessun servizio di analisi del traffico.'
        ]
      },
      {
        titolo: 'Perché, e con quale base giuridica',
        voci: [
          'Far funzionare l\'applicazione, cioè registrare i turni, calcolare ore, percentuali e straordinari e sincronizzare fra i tuoi dispositivi: la base è il contratto, cioè il servizio che hai chiesto attivando un account.',
          'Riconoscerti all\'accesso e tenere al sicuro l\'account: sempre l\'esecuzione del servizio, insieme al legittimo interesse a impedire accessi altrui.',
          'Il questionario sul benessere e il punteggio di rischio: solo con il tuo consenso esplicito, perché riguardano la salute. Senza consenso il questionario non si apre e nessun dato di questo tipo viene creato.',
          'La conversazione con l\'intelligenza artificiale: solo con il tuo consenso, che puoi ritirare quando vuoi.',
          'Il rilevamento della posizione: solo con il tuo consenso, dato attivandolo nelle impostazioni e ritirabile spegnendolo.'
        ],
        paragrafi: [
          'Dove la base è il consenso, ritirarlo è facile quanto darlo: gli stessi interruttori funzionano nelle due direzioni. Il ritiro vale da quel momento in avanti e non rende illecito ciò che è avvenuto prima.'
        ]
      },
      {
        titolo: 'Chi altro vede i dati',
        paragrafi: [
          'Per far funzionare il servizio ci si appoggia a fornitori che trattano i dati per conto del titolare e solo per le finalità qui descritte:'
        ],
        voci: [
          'Clerk, per la gestione degli account e dell\'accesso: tratta email, nome utente e le informazioni del metodo di accesso che scegli, compresi Google, Apple o Facebook se usi uno di quelli.',
          'Supabase, per il database che conserva turni, check-in e impostazioni sincronizzati: i dati sono ospitati su server nell\'Unione Europea, nella regione di Francoforte.',
          'GitHub Pages, che ospita i file del sito.',
          'Google, per il modello che risponde nella conversazione con l\'intelligenza artificiale: riceve il riepilogo aggregato solo quando scrivi un messaggio, e solo per il tempo di rispondere.'
        ],
        coda: [
          'Alcuni di questi fornitori hanno sede negli Stati Uniti. In quei casi il trasferimento avviene sulla base delle garanzie previste dal Regolamento, cioè le clausole contrattuali standard della Commissione europea o l\'adesione del fornitore al quadro di adeguatezza fra Unione europea e Stati Uniti.',
          'Una nota che è giusto tu sappia: chi amministra questa installazione può vedere e correggere i dati degli account dalla pagina di amministrazione. È un accesso tecnico, limitato alle persone indicate nella tabella degli amministratori del database, e serve a rimediare a errori o a rispondere alle tue richieste. Non viene usato per altro.',
          'I dati non vengono venduti, ceduti a fini commerciali né usati per costruire profili pubblicitari.'
        ]
      },
      {
        titolo: 'Per quanto tempo restano',
        paragrafi: [
          'Sul dispositivo: finché non li cancelli tu o non disinstalli l\'applicazione. Il pulsante di cancellazione nelle impostazioni li rimuove subito.',
          'Sul server: finché tieni l\'account. Quando chiedi la cancellazione dell\'account, turni, check-in, impostazioni e anagrafica vengono eliminati contestualmente; le copie di sicurezza del fornitore del database si sovrascrivono nell\'arco di trenta giorni.',
          'I registri tecnici dei fornitori seguono i loro tempi di conservazione, nell\'ordine di alcune settimane.',
          'Un caso a parte: se un amministratore chiude un account per un uso contrario alle condizioni, del passaggio resta un registro con l\'indirizzo email, la motivazione e la data. Serve a rendere conto della decisione e a poter rispondere se viene contestata, e lo vedono solo gli amministratori. La motivazione viene comunicata per email alla persona interessata nel momento in cui la chiusura avviene.'
        ]
      },
      {
        titolo: 'I tuoi diritti, e come esercitarli qui dentro',
        paragrafi: [
          'Il Regolamento ti riconosce il diritto di accedere ai tuoi dati, farli correggere, cancellare, limitarne il trattamento, opporti e riceverli in un formato leggibile da un\'altra applicazione. Tre di questi si esercitano direttamente dall\'applicazione, senza chiedere niente a nessuno:'
        ],
        voci: [
          'Accesso e portabilità: il pulsante di esportazione nelle impostazioni scarica tutto quello che c\'è, in JSON o in CSV, formati aperti che un\'altra applicazione può leggere.',
          'Rettifica: ogni turno, ogni orario e ogni impostazione si modifica dall\'applicazione in qualsiasi momento.',
          'Cancellazione: il pulsante per eliminare account e dati rimuove i dati locali e quelli sul server, e chiude l\'account.'
        ],
        coda: [
          'Per tutto il resto, e per le richieste che non passano da un pulsante, scrivi a donatotaucci@gmail.com. La risposta arriva entro un mese.',
          'Se ritieni che il trattamento dei tuoi dati violi il Regolamento puoi presentare reclamo all\'autorità di controllo del tuo Paese. In Italia è il Garante per la protezione dei dati personali, www.garanteprivacy.it.'
        ]
      },
      {
        titolo: 'Cookie e memoria del dispositivo',
        paragrafi: [
          'Il sito non usa cookie di profilazione né cookie di terze parti a fini pubblicitari, e per questo non trovi nessun banner da chiudere.',
          'Usa la memoria locale del dispositivo per conservare i tuoi turni, le impostazioni e la lingua scelta: è ciò che permette di funzionare senza connessione. Sono dati che restano sul tuo dispositivo e non vengono letti da nessun altro.',
          'Il servizio di accesso imposta i cookie tecnici necessari a mantenerti autenticato. Senza quelli l\'accesso non funzionerebbe.'
        ]
      },
      {
        titolo: 'Minori',
        paragrafi: [
          'L\'applicazione è pensata per chi lavora e non è destinata a chi ha meno di sedici anni.'
        ]
      },
      {
        titolo: 'Modifiche a questa informativa',
        paragrafi: [
          'Se il trattamento cambia in modo sostanziale il documento viene aggiornato e la data in cima cambia. Le modifiche che riguardano trattamenti basati sul consenso non si applicano retroattivamente: verrà chiesto di nuovo.'
        ]
      }
    ]
  };

  var NOTA_IA = {
    titolo: 'Come viene usata l\'intelligenza artificiale',
    intro: [
      'Quasi tutto in questa applicazione non è intelligenza artificiale: è aritmetica. Ore, percentuali, straordinari, indice di rischio e consigli sono calcolati sul tuo dispositivo da regole fisse, scritte una volta e sempre uguali a parità di dati.',
      'L\'unica parte che usa un modello di intelligenza artificiale è la conversazione facoltativa nella sezione Benessere del sito. È spenta finché non la accendi tu, e ogni account ha un numero limitato di messaggi al mese.'
    ],
    sezioni: [
      {
        titolo: 'Con che cosa stai parlando',
        paragrafi: [
          'Quando apri quella conversazione stai scrivendo a un sistema di intelligenza artificiale, non a una persona. È Gemini, un modello linguistico di Google, che il nostro server interroga per conto tuo.',
          'Le risposte generate dal modello sono contrassegnate come tali nell\'interfaccia, in modo che non si confondano mai con un testo scritto da un essere umano o con un calcolo dell\'applicazione.'
        ]
      },
      {
        titolo: 'Che cosa viene inviato, e che cosa no',
        paragrafi: [
          'Viene inviato un riepilogo aggregato del periodo: ore totali, media settimanale, straordinari, giorni lavorati e di riposo, giornate lunghe, turni notturni, e il punteggio dell\'ultimo check-in con le sue voci.',
          'Non vengono inviati i singoli turni, le note che scrivi sui turni, la tua posizione, il tuo indirizzo email né il tuo nome utente.',
          'La richiesta passa da un nostro servizio, che vi aggiunge le istruzioni date al modello e conta i messaggi del mese. Il testo della conversazione non viene conservato: finita la risposta, sul server non ne resta traccia, e sul dispositivo resta finché non ricarichi la pagina.'
        ]
      },
      {
        titolo: 'Che cosa può e che cosa non può fare',
        voci: [
          'Può sbagliare. Un modello linguistico produce testo plausibile, non verità verificate: le sue affermazioni vanno lette come un\'opinione da valutare, non come un referto.',
          'Non è un medico né uno psicologo, non formula diagnosi e non sostituisce un consulto. Per un malessere intenso o prolungato il riferimento resta il medico di base, uno psicologo o il medico competente aziendale.',
          'Non decide niente al posto tuo. Non prende decisioni automatizzate che producano effetti su di te, non segnala nulla a nessuno e non cambia i tuoi dati.',
          'Non ti valuta come lavoratore, e i suoi testi non vengono usati per valutarti.'
        ]
      },
      {
        titolo: 'Uso previsto, e uso non previsto',
        paragrafi: [
          'Work Balance è uno strumento personale: lo usa la persona che lavora, sui propri dati, per capire quanto sta lavorando e come sta.',
          'Non è destinato al monitoraggio, alla sorveglianza o alla valutazione dei lavoratori da parte di un datore di lavoro, e non va usato per quello. Un impiego di questo genere ricadrebbe fra i sistemi ad alto rischio previsti dal regolamento europeo sull\'intelligenza artificiale e richiederebbe obblighi, garanzie e valutazioni che questa applicazione non ha e non dichiara di avere.',
          'Il questionario sul benessere non è un riconoscimento delle emozioni: non guarda il tuo viso, non ascolta la tua voce e non deduce nulla da come ti comporti. Sono domande a cui rispondi tu, volontariamente, su te stesso, e le risposte le vedi solo tu.'
        ]
      },
      {
        titolo: 'Sorveglianza umana e segnalazioni',
        paragrafi: [
          'Chi decide che cosa farne sei tu: puoi ignorare qualsiasi suggerimento, cancellare la conversazione in un tocco e revocare il consenso in qualsiasi momento dalle impostazioni.',
          'Se una risposta ti sembra sbagliata, dannosa o fuori luogo, segnalala a donatotaucci@gmail.com. Le segnalazioni servono a correggere le istruzioni date al modello o a disattivare la funzione.'
        ]
      }
    ]
  };

  /* ---------------- resa in HTML ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function paragrafi(lista) {
    return (lista || []).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
  }

  function elenco(voci) {
    if (!voci || !voci.length) return '';
    return '<ul class="doc-lista">' + voci.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>';
  }

  function dataLeggibile() {
    try {
      return new Date(AGGIORNATA + 'T00:00:00').toLocaleDateString(global.I18n ? global.I18n.lingua() : 'it', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) {
      return AGGIORNATA;
    }
  }

  function rendi(doc) {
    var html = '<div class="doc">';
    html += '<h2>' + esc(doc.titolo) + '</h2>';
    html += '<p class="doc-data">Ultimo aggiornamento: <span data-no-i18n>' + esc(dataLeggibile()) + '</span></p>';
    html += '<div class="note">' + paragrafi(doc.intro) + '</div>';
    doc.sezioni.forEach(function (s) {
      html += '<section class="doc-sez"><h3>' + esc(s.titolo) + '</h3>' +
        paragrafi(s.paragrafi) + elenco(s.voci) + paragrafi(s.coda) + '</section>';
    });
    html += '</div>';
    return html;
  }

  global.Legale = {
    informativa: function () { return rendi(INFORMATIVA); },
    notaIA: function () { return rendi(NOTA_IA); },
    INFORMATIVA: INFORMATIVA,
    NOTA_IA: NOTA_IA,
    contatto: CONTATTO,
    aggiornata: AGGIORNATA
  };
})(window);
