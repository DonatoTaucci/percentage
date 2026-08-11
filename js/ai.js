/* ai.js — la conversazione della sezione Benessere.

   Qui non c'è più nessuna chiave e nessun modello: la richiesta va alla
   funzione `benessere-ia` sul server, che tiene la chiave, conta la quota
   mensile e decide le istruzioni date al modello. Il client si limita a
   preparare il riepilogo dei numeri e a mostrare la risposta.

   Il riepilogo lo compone il dispositivo perché è già tutto calcolato qui
   (coach.js) e perché così resta vero ciò che dice l'informativa: parte un
   aggregato, non i turni. Il server lo tronca comunque, che è il modo di non
   fidarsi della lunghezza senza dover ricalcolare tutto una seconda volta. */
(function (global) {
  'use strict';

  var stato = {
    usati: null,
    limite: null,
    ruoli: [],
    caricato: false
  };

  var ascoltatori = [];
  function notifica() { ascoltatori.forEach(function (fn) { fn(stato); }); }

  /** Riassunto compatto dei dati per il contesto del modello. */
  function contextBlock() {
    var settings = Store.settings();
    var m = Coach.workMetrics(Store.shifts(), settings);
    var last = Store.lastCheckin();
    var lines = [];

    lines.push('DATI TURNI (ultimi 28 giorni, generati dall\'app):');
    if (!m.datiSufficienti) {
      lines.push('- Dati insufficienti: meno di 3 giornate lavorate registrate.');
    } else {
      lines.push('- Ore lavorate totali: ' + (m.giorni28.worked / 60).toFixed(1).replace('.', ',') + ' h');
      lines.push('- Media settimanale: ' + m.mediaSettimanale.toFixed(1).replace('.', ',') + ' h');
      lines.push('- Ore contrattuali giornaliere: ' + settings.oreGiornaliere + ' h su ' + (settings.giorniLavorativi || []).length + ' giorni/settimana');
      lines.push('- Straordinari nel periodo: ' + m.straordinari28.toFixed(1).replace('.', ',') + ' h');
      lines.push('- Percentuale ore lavorate sul previsto: ' + Calc.fmtPct(m.pctMese));
      lines.push('- Giorni lavorati: ' + m.giorniLavorati28 + ' / giorni di riposo: ' + m.giorniRiposo28);
      lines.push('- Serie più lunga senza riposo: ' + m.streakMax + ' giorni (attualmente ' + m.streakCorrente + ')');
      lines.push('- Giornate da 10 h o più: ' + m.giorniLunghi);
      lines.push('- Giornate lunghe senza pausa registrata: ' + m.giorniSenzaPausa);
      lines.push('- Turni serali/notturni: ' + m.turniNotturni);
    }

    if (last && last.dims) {
      lines.push('');
      lines.push('ULTIMO CHECK-IN BENESSERE (' + new Date(last.ts).toLocaleDateString(global.I18n ? global.I18n.lingua() : 'it') + ', 0 = nessun problema, 100 = massima criticità):');
      lines.push('- Punteggio complessivo: ' + last.score + ' (' + (last.level || '') + ')');
      Object.keys(Coach.DIMENSIONS).forEach(function (k) {
        if (last.dims[k] !== null && last.dims[k] !== undefined) {
          lines.push('- ' + Coach.DIMENSIONS[k].label + ': ' + last.dims[k]);
        }
      });
    } else {
      lines.push('');
      lines.push('Nessun check-in benessere compilato finora.');
    }

    return lines.join('\n');
  }

  /* La conversazione esiste solo con un account: la quota è per persona, e
     senza persona non c'è quota da contare. */
  function disponibile() {
    return !!(global.Cloud && global.Cloud.connesso());
  }

  /** Quota residua e ruoli, letti dal server. Non consuma niente. */
  function aggiornaStato() {
    if (!disponibile() || !global.Cloud.stato().supabase) return Promise.resolve(stato);
    return global.Cloud.stato().supabase.rpc('stato_ia').then(function (res) {
      if (res.error) return stato;
      var d = res.data || {};
      stato.usati = d.usati || 0;
      stato.limite = typeof d.limite === 'number' ? d.limite : null;
      stato.ruoli = Array.isArray(d.ruoli) ? d.ruoli : [];
      stato.caricato = true;
      notifica();
      return stato;
    }).catch(function () { return stato; });
  }

  /**
   * Invia la conversazione alla funzione sul server.
   * history: [{ role:'user'|'assistant', content:'...' }]
   */
  function ask(history) {
    if (!disponibile()) return Promise.reject(new Error('non-autenticato'));
    return global.Cloud.chiamaFunzione('benessere-ia', {
      messaggi: history.slice(-20).map(function (m) {
        return { role: m.role, content: m.content };
      }),
      riepilogo: contextBlock(),
      lingua: global.I18n ? global.I18n.lingua() : 'it'
    }).then(function (d) {
      if (typeof d.usati === 'number') stato.usati = d.usati;
      if (typeof d.limite === 'number') stato.limite = d.limite;
      stato.caricato = true;
      notifica();
      return { text: d.testo, bloccato: !!d.bloccato };
    });
  }

  /** Prima richiesta: analisi completa del periodo. */
  function analyze() {
    return ask([{
      role: 'user',
      content: 'Analizza i miei dati di lavoro e l\'ultimo check-in. Dimmi: 1) cosa emerge di più significativo, 2) qual è il rischio principale nelle prossime settimane se non cambia nulla, 3) i due cambiamenti con il miglior rapporto sforzo/beneficio. Sii specifico sui numeri.'
    }]);
  }

  /* Traduzione dei codici di errore in frasi.

     Quota esaurita e chiave mancante non sono guasti dello stesso tipo: la
     prima riguarda l'utente e ha una data di scadenza, la seconda riguarda
     chi gestisce il servizio e l'utente non può farci niente. Dirle nello
     stesso modo manderebbe a cercare il problema nel posto sbagliato. */
  function messaggioErrore(err) {
    var codice = String(err && err.message || '');
    var d = (err && err.dati) || {};
    if (codice === 'quota-esaurita') {
      return T('Hai usato tutti i {limite} messaggi di questo mese. La quota si azzera il primo del mese prossimo.', { limite: d.limite || stato.limite || 0 });
    }
    if (codice === 'nessun-accesso') return T('Il tuo account non ha accesso alla conversazione con l\'IA.');
    if (codice === 'non-autenticato') return T('Serve l\'accesso per usare la conversazione.');
    if (codice === 'chiave-mancante') return T('Il servizio non è ancora configurato: l\'assistente è momentaneamente spento.');
    if (codice === 'modello' || codice === 'rete' || codice === 'risposta-vuota') {
      return T('L\'assistente non ha risposto. Riprova fra poco.');
    }
    return T('Non sono riuscito a rispondere: {errore}', { errore: codice });
  }

  global.AI = {
    disponibile: disponibile,
    stato: function () { return stato; },
    onChange: function (fn) { ascoltatori.push(fn); },
    aggiornaStato: aggiornaStato,
    ask: ask,
    analyze: analyze,
    contextBlock: contextBlock,
    messaggioErrore: messaggioErrore
  };
})(window);
