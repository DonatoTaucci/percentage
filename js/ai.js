/* ai.js — approfondimento opzionale con l'API di Claude.
   La chiave resta nel localStorage del dispositivo e viene inviata solo ad api.anthropic.com.
   Senza chiave l'app funziona comunque: l'analisi di base è tutta locale (coach.js). */
(function (global) {
  'use strict';

  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var API_VERSION = '2023-06-01';

  var LINGUE = { it: 'italiano', en: 'inglese', es: 'spagnolo', fr: 'francese', de: 'tedesco' };

  function lingua() {
    var code = global.I18n ? global.I18n.lingua() : 'it';
    return LINGUE[code] || 'italiano';
  }

  var SYSTEM = [
    'Sei un assistente che aiuta un lavoratore a riflettere su carico di lavoro, stress, ansia da lavoro e prevenzione del burnout.',
    'Rispondi sempre in {LINGUA}, con un tono diretto e concreto, senza retorica motivazionale.',
    '',
    'Come lavori:',
    '- Parti dai dati reali dei turni che ti vengono forniti e citali quando sono rilevanti (ore, straordinari, giorni consecutivi, pause).',
    '- Dai al massimo 3 suggerimenti per risposta, ciascuno con un primo passo eseguibile entro la settimana.',
    '- Se una condizione dipende dall\'organizzazione del lavoro e non dalla persona, dillo esplicitamente invece di suggerire di "gestire meglio lo stress".',
    '- Fai una domanda di chiarimento solo quando la risposta cambierebbe davvero il consiglio.',
    '',
    'Limiti:',
    '- Non sei un medico né uno psicoterapeuta e non formuli diagnosi.',
    '- Se emergono segnali di sofferenza intensa o persistente, invita con naturalezza a rivolgersi al medico di base, a uno psicologo o al medico competente aziendale.',
    '- Se emergono riferimenti ad autolesionismo o pensieri suicidari, interrompi i consigli pratici, esprimi vicinanza e indica di contattare subito un servizio di emergenza (112) o il Telefono Amico (02 2327 2327).',
    '',
    'Non inventare dati che non ti sono stati forniti. Mantieni le risposte sotto le 250 parole salvo richiesta esplicita.'
  ].join('\n');

  function hasKey() {
    return !!(Store.get().aiKey || '').trim();
  }

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
      lines.push('ULTIMO CHECK-IN BENESSERE (' + new Date(last.ts).toLocaleDateString(window.I18n ? window.I18n.lingua() : 'it') + ', 0 = nessun problema, 100 = massima criticità):');
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

  /**
   * Invia la conversazione all'API.
   * history: [{ role:'user'|'assistant', content:'...' }]
   */
  function ask(history) {
    var key = (Store.get().aiKey || '').trim();
    if (!key) return Promise.reject(new Error('Nessuna chiave API configurata.'));

    var model = Store.get().aiModel || 'claude-opus-5';
    var messages = history.slice(-20).map(function (m) {
      return { role: m.role, content: m.content };
    });

    // Il contesto dati va in coda al system prompt: cambia raramente e resta separato dalla conversazione.
    // La lingua è quella dell'interfaccia: chi legge il sito in tedesco non
    // deve ricevere l'unica risposta della pagina in italiano.
    var system = SYSTEM.replace('{LINGUA}', lingua()) + '\n\n---\n' + contextBlock();

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4000,
        system: system,
        messages: messages
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var msg = (data && data.error && data.error.message) || ('Errore HTTP ' + res.status);
          throw new Error(msg);
        }
        return data;
      });
    }).then(function (data) {
      if (data.stop_reason === 'refusal') {
        throw new Error('Il modello ha rifiutato di rispondere a questa richiesta.');
      }
      var text = (data.content || [])
        .filter(function (b) { return b.type === 'text'; })
        .map(function (b) { return b.text; })
        .join('\n')
        .trim();
      if (!text) throw new Error('Risposta vuota dal modello.');
      return { text: text, usage: data.usage || null };
    });
  }

  /** Prima richiesta: analisi completa del periodo. */
  function analyze() {
    return ask([{
      role: 'user',
      content: 'Analizza i miei dati di lavoro e l\'ultimo check-in. Dimmi: 1) cosa emerge di più significativo, 2) qual è il rischio principale nelle prossime settimane se non cambia nulla, 3) i due cambiamenti con il miglior rapporto sforzo/beneficio. Sii specifico sui numeri.'
    }]);
  }

  global.AI = {
    hasKey: hasKey,
    ask: ask,
    analyze: analyze,
    contextBlock: contextBlock,
    SYSTEM: SYSTEM
  };
})(window);
