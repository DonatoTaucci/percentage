/* coach.js — assistente benessere.
   Unisce i dati oggettivi dei turni con un questionario soggettivo
   e produce un profilo di rischio con consigli pratici.

   Nota: è uno strumento di auto-osservazione, non una diagnosi clinica. */
(function (global) {
  'use strict';

  var SCALE = ['Mai', 'Raramente', 'A volte', 'Spesso', 'Sempre'];

  var DIMENSIONS = {
    esaurimento: { label: 'Esaurimento', desc: 'Energia residua a fine giornata' },
    recupero:    { label: 'Recupero',    desc: 'Capacità di staccare e ricaricarti' },
    sonno:       { label: 'Sonno',       desc: 'Qualità e continuità del riposo' },
    carico:      { label: 'Carico',      desc: 'Quantità e ritmo del lavoro' },
    confini:     { label: 'Confini',     desc: 'Separazione fra lavoro e vita privata' },
    ansia:       { label: 'Ansia',       desc: 'Tensione e preoccupazione legate al lavoro' },
    distacco:    { label: 'Coinvolgimento', desc: 'Senso e motivazione nel lavoro' },
    supporto:    { label: 'Supporto',    desc: 'Aiuto da colleghi e responsabili' }
  };

  /* Ogni domanda: punteggio 0..4 dove 4 = condizione peggiore.
     invert: true quando rispondere "Sempre" è positivo. */
  var QUESTIONS = [
    { id: 'q1',  dim: 'esaurimento', text: 'Ti senti svuotato/a di energie alla fine della giornata di lavoro?' },
    { id: 'q2',  dim: 'esaurimento', text: 'Ti svegli già stanco/a al pensiero della giornata che ti aspetta?' },
    { id: 'q3',  dim: 'recupero',    text: 'Nel tempo libero riesci a staccare davvero dal lavoro?', invert: true },
    { id: 'q4',  dim: 'recupero',    text: 'Un giorno di riposo ti basta per sentirti recuperato/a?', invert: true },
    { id: 'q5',  dim: 'sonno',       text: 'Fatichi ad addormentarti o ti svegli durante la notte pensando al lavoro?' },
    { id: 'q6',  dim: 'sonno',       text: 'Dormi almeno 7 ore per notte nei giorni lavorativi?', invert: true },
    { id: 'q7',  dim: 'carico',      text: 'Hai la sensazione che il lavoro da fare sia più di quello che riesci a gestire?' },
    { id: 'q8',  dim: 'carico',      text: 'Salti la pausa pranzo o la fai davanti al computer / in postazione?' },
    { id: 'q9',  dim: 'confini',     text: 'Rispondi a messaggi, mail o chiamate di lavoro fuori orario?' },
    { id: 'q10', dim: 'confini',     text: 'Riesci a dire di no quando ti viene chiesto un turno o uno straordinario in più?', invert: true },
    { id: 'q11', dim: 'ansia',       text: 'Provi tensione, nodo allo stomaco o batticuore pensando al lavoro?' },
    { id: 'q12', dim: 'ansia',       text: 'Ti capita di rimuginare su errori o su cose ancora da fare quando non lavori?' },
    { id: 'q13', dim: 'distacco',    text: 'Ti senti cinico/a, indifferente o infastidito/a verso il tuo lavoro?' },
    { id: 'q14', dim: 'distacco',    text: 'Il tuo lavoro ti dà ancora un senso di soddisfazione?', invert: true },
    { id: 'q15', dim: 'supporto',    text: 'Se sei in difficoltà, hai qualcuno (collega o responsabile) su cui contare?', invert: true },
    { id: 'q16', dim: 'supporto',    text: 'Ti senti riconosciuto/a per il lavoro che fai?', invert: true }
  ];

  var LEVELS = [
    { min: 0,  key: 'basso',    label: 'Rischio basso',    tone: 'ok',   msg: 'Il tuo equilibrio sembra sostenibile. Continua a monitorarlo.' },
    { min: 30, key: 'moderato', label: 'Rischio moderato', tone: 'warn', msg: 'Alcuni segnali iniziali di affaticamento: è il momento migliore per intervenire.' },
    { min: 52, key: 'elevato',  label: 'Rischio elevato',  tone: 'bad',  msg: 'Diversi indicatori sono sopra soglia. Servono cambiamenti concreti, non solo riposo occasionale.' },
    { min: 72, key: 'critico',  label: 'Rischio molto alto', tone: 'bad', msg: 'Il quadro è pesante e prolungato. Parlarne con un professionista (medico o psicologo del lavoro) è la scelta più sensata.' }
  ];

  function levelFor(score) {
    var out = LEVELS[0];
    LEVELS.forEach(function (l) { if (score >= l.min) out = l; });
    return out;
  }

  /* ---------- punteggio questionario ---------- */

  function scoreAnswers(answers) {
    var sums = {}, counts = {};
    Object.keys(DIMENSIONS).forEach(function (d) { sums[d] = 0; counts[d] = 0; });

    var answered = 0;
    QUESTIONS.forEach(function (q) {
      var v = answers[q.id];
      if (v === undefined || v === null) return;
      answered++;
      var val = q.invert ? 4 - v : v;
      sums[q.dim] += val;
      counts[q.dim]++;
    });

    var dims = {};
    var total = 0, dimCount = 0;
    Object.keys(DIMENSIONS).forEach(function (d) {
      if (counts[d] === 0) { dims[d] = null; return; }
      var pct = (sums[d] / (counts[d] * 4)) * 100;
      dims[d] = Math.round(pct);
      total += pct;
      dimCount++;
    });

    return {
      dims: dims,
      score: dimCount ? Math.round(total / dimCount) : 0,
      answered: answered,
      totalQuestions: QUESTIONS.length
    };
  }

  /* ---------- indicatori oggettivi dai turni ---------- */

  function workMetrics(shifts, settings, refISO) {
    var ref = refISO || Calc.today();
    var from = Calc.addDays(ref, -27);
    var s28 = Calc.rangeSummary(from, ref, shifts, settings);
    var s7 = Calc.rangeSummary(Calc.addDays(ref, -6), ref, shifts, settings);

    var weeks = [];
    for (var i = 3; i >= 0; i--) {
      var a = Calc.addDays(ref, -(7 * i) - 6);
      var b = Calc.addDays(ref, -(7 * i));
      weeks.push(Calc.rangeSummary(a, b, shifts, settings));
    }

    var oreSett = weeks.map(function (w) { return w.worked / 60; });
    var mediaSett = oreSett.reduce(function (a, b) { return a + b; }, 0) / (oreSett.length || 1);
    var variabilita = 0;
    if (oreSett.length > 1) {
      var m = mediaSett;
      variabilita = Math.sqrt(oreSett.reduce(function (acc, v) { return acc + (v - m) * (v - m); }, 0) / oreSett.length);
    }

    var riposi28 = s28.days.filter(function (d) { return d.worked === 0; }).length;

    return {
      refDate: ref,
      giorni28: s28,
      ultimi7: s7,
      settimane: weeks,
      oreSettimanali: oreSett,
      mediaSettimanale: mediaSett,
      variabilitaSettimanale: variabilita,
      straordinari28: s28.overtime / 60,
      straordinari7: s7.overtime / 60,
      giorniLavorati28: s28.workedDays,
      giorniRiposo28: riposi28,
      streakCorrente: Calc.currentStreak(s28.days),
      streakMax: Calc.maxStreak(s28.days),
      giorniSenzaPausa: s28.noBreakDays,
      giorniLunghi: s28.longDays,
      turniNotturni: s28.nightDays,
      pctMese: s28.pct,
      datiSufficienti: s28.workedDays >= 3
    };
  }

  /* Punteggio di rischio derivato dai soli dati oggettivi (0-100). */
  function objectiveRisk(m) {
    if (!m.datiSufficienti) return { score: null, flags: [] };
    var pts = 0;
    var flags = [];

    if (m.mediaSettimanale > 55) { pts += 26; flags.push('Media di ' + m.mediaSettimanale.toFixed(1).replace('.', ',') + ' ore settimanali: ben oltre la soglia di sicurezza.'); }
    else if (m.mediaSettimanale > 48) { pts += 18; flags.push('Media di ' + m.mediaSettimanale.toFixed(1).replace('.', ',') + ' ore settimanali: sopra il limite di 48 ore.'); }
    else if (m.mediaSettimanale > 44) { pts += 9; flags.push('Media settimanale sopra le 44 ore.'); }

    if (m.straordinari28 > 30) { pts += 18; flags.push(m.straordinari28.toFixed(1).replace('.', ',') + ' ore di straordinario in 4 settimane.'); }
    else if (m.straordinari28 > 15) { pts += 10; flags.push(m.straordinari28.toFixed(1).replace('.', ',') + ' ore di straordinario in 4 settimane.'); }
    else if (m.straordinari28 > 6) { pts += 4; }

    if (m.streakMax >= 12) { pts += 20; flags.push(m.streakMax + ' giorni lavorati di fila senza riposo.'); }
    else if (m.streakMax >= 8) { pts += 13; flags.push(m.streakMax + ' giorni consecutivi senza un giorno libero.'); }
    else if (m.streakMax >= 7) { pts += 7; flags.push('Una settimana intera senza giorni di riposo.'); }

    if (m.giorniRiposo28 <= 3) { pts += 14; flags.push('Solo ' + m.giorniRiposo28 + ' giorni di riposo negli ultimi 28.'); }
    else if (m.giorniRiposo28 <= 5) { pts += 7; }

    if (m.giorniSenzaPausa >= 8) { pts += 12; flags.push(m.giorniSenzaPausa + ' giornate lunghe senza pausa registrata.'); }
    else if (m.giorniSenzaPausa >= 4) { pts += 6; flags.push(m.giorniSenzaPausa + ' giornate senza pausa registrata.'); }

    if (m.giorniLunghi >= 6) { pts += 10; flags.push(m.giorniLunghi + ' giornate da 10 ore o più.'); }
    else if (m.giorniLunghi >= 3) { pts += 5; }

    if (m.turniNotturni >= 8) { pts += 8; flags.push(m.turniNotturni + ' turni serali o notturni nel periodo.'); }
    else if (m.turniNotturni >= 4) { pts += 4; }

    if (m.variabilitaSettimanale > 12) { pts += 6; flags.push('Carico molto irregolare fra una settimana e l\'altra.'); }

    return { score: Math.min(100, pts), flags: flags };
  }

  /* ---------- generazione consigli ---------- */

  function advice(subj, m, obj) {
    var out = [];
    var dims = subj ? subj.dims : {};
    function d(k) { return dims && dims[k] !== null && dims[k] !== undefined ? dims[k] : null; }
    function push(priority, title, text, actions) {
      out.push({ priority: priority, title: title, text: text, actions: actions || [] });
    }

    /* --- priorità 1: segnali forti --- */

    if (m.datiSufficienti && m.streakCorrente >= 7) {
      push(1, 'Stai lavorando da ' + m.streakCorrente + ' giorni di fila',
        'Il recupero non è lineare: dopo il sesto giorno consecutivo la stanchezza si accumula più in fretta di quanto un solo giorno libero riesca a compensare.',
        ['Programma un giorno completamente libero entro i prossimi 3 giorni e mettilo in calendario come un impegno vero.',
         'Se non è possibile, alterna almeno una mezza giornata senza attività lavorative né reperibilità.']);
    }

    if (m.datiSufficienti && m.mediaSettimanale > 48) {
      push(1, 'Media settimanale oltre le 48 ore',
        'Negli ultimi 28 giorni la tua media è di ' + m.mediaSettimanale.toFixed(1).replace('.', ',') + ' ore a settimana. Oltre le 48 ore il rischio di errori, incidenti e disturbi del sonno cresce in modo misurabile.',
        ['Individua le 2-3 attività che generano più ore extra e verifica cosa è delegabile o rinviabile.',
         'Porta il dato (non l\'impressione) a chi organizza i turni: "media di ' + m.mediaSettimanale.toFixed(1).replace('.', ',') + ' h/settimana nelle ultime 4 settimane".',
         'Fissa un tetto settimanale realistico e trattalo come un vincolo, non come un obiettivo.']);
    }

    if (d('esaurimento') !== null && d('esaurimento') >= 65) {
      push(1, 'Segnali di esaurimento',
        'Le tue risposte indicano una stanchezza che non si esaurisce con il riposo normale. È il segnale più predittivo del burnout, e non si risolve aumentando la forza di volontà.',
        ['Per due settimane proteggi una cosa sola: l\'orario di fine giornata. È il cambiamento con il rapporto sforzo/effetto migliore.',
         'Riduci le decisioni fuori dal lavoro (pasti, vestiti, spesa) con routine fisse: liberano energia mentale.',
         'Se la stanchezza persiste oltre 2-3 settimane nonostante il riposo, parlane con il medico di base.']);
    }

    if (d('ansia') !== null && d('ansia') >= 65) {
      push(1, 'Tensione e rimuginio',
        'Preoccupazione anticipatoria e rimuginio tengono il corpo in allerta anche quando non lavori: è il motivo per cui il riposo "non funziona".',
        ['Chiudi la giornata con 5 minuti di scarico: scrivi ciò che è rimasto aperto e il primo passo per domani. Il cervello smette di ripassarlo.',
         'Definisci una "finestra della preoccupazione" di 15 minuti al giorno; fuori da lì rimanda i pensieri alla finestra successiva.',
         'Respirazione lenta (4 secondi dentro, 6 fuori) per 3 minuti abbassa l\'attivazione fisiologica più della distrazione.']);
    }

    /* --- priorità 2: aree specifiche --- */

    if (d('sonno') !== null && d('sonno') >= 50) {
      push(2, 'Il sonno sta pagando il conto',
        'Il sonno è il primo sistema a cedere sotto stress lavorativo ed è anche quello che, una volta recuperato, migliora tutto il resto.',
        ['Orario di sveglia fisso tutti i giorni, weekend inclusi: stabilizza il ritmo più di quanto faccia andare a letto presto.',
         'Ultimo controllo di mail e chat almeno 60 minuti prima di dormire.',
         m.turniNotturni >= 4 ? 'Con turni serali/notturni: luce intensa a inizio turno, buio e occhiali scuri nel rientro a casa.' : 'Se non ti addormenti entro 20 minuti, alzati e fai qualcosa di noioso a luce bassa.']);
    }

    if (d('recupero') !== null && d('recupero') >= 50) {
      push(2, 'Recupero incompleto',
        'Il distacco psicologico dal lavoro nel tempo libero conta più della quantità di tempo libero in sé.',
        ['Crea un rituale di transizione fine-turno: 10 minuti di camminata, doccia o cambio di abiti. Segnala al cervello che il turno è finito.',
         'Metti almeno un\'attività a settimana che richieda attenzione piena (sport, musica, mani): il recupero attivo batte lo scrolling.',
         'Togli le notifiche di lavoro dal telefono personale, o usa una modalità di concentrazione programmata.']);
    }

    if (d('confini') !== null && d('confini') >= 50) {
      push(2, 'Confini poco definiti',
        'Reperibilità informale e difficoltà a rifiutare fanno espandere il lavoro fino a occupare tutto lo spazio disponibile.',
        ['Dichiara una regola esplicita e ripetibile: "dopo le 19 rispondo il mattino dopo, salvo emergenze definite".',
         'Sostituisci il "no" secco con un no negoziato: "questa settimana no; posso il martedì della prossima".',
         'Quando accetti un extra, chiedi contestualmente cosa slitta: rende visibile il costo reale.']);
    }

    if (d('supporto') !== null && d('supporto') >= 55) {
      push(2, 'Poco supporto percepito',
        'L\'isolamento amplifica ogni altro fattore di rischio; il supporto sociale è invece uno dei fattori protettivi più solidi.',
        ['Individua una persona di fiducia al lavoro e proponi un confronto breve ma regolare (15 minuti a settimana).',
         'Porta i problemi come dati e proposte, non come lamentele: aumenta la probabilità che vengano presi sul serio.',
         'Verifica se esistono sportelli di ascolto, RSU o medico competente: sono canali già previsti e spesso poco usati.']);
    }

    if (d('distacco') !== null && d('distacco') >= 55) {
      push(2, 'Distacco e perdita di senso',
        'Cinismo e disinvestimento sono la seconda fase classica del burnout: raramente sono un problema di carattere, quasi sempre di condizioni.',
        ['Elenca le attività della settimana che ti hanno dato energia e quelle che l\'hanno tolta: cerca di spostare il rapporto anche solo del 10%.',
         'Recupera un margine di controllo dove puoi: ordine delle attività, metodo, orario. L\'autonomia percepita protegge dal cinismo.',
         'Se il senso manca da mesi e le condizioni non sono modificabili, valutare un cambiamento è una risposta legittima, non una resa.']);
    }

    if (d('carico') !== null && d('carico') >= 55) {
      push(2, 'Carico oltre la capacità',
        'Quando la domanda supera stabilmente le risorse, il divario non si colma lavorando più in fretta.',
        ['Per una settimana annota le interruzioni: spesso il problema non è il volume ma la frammentazione.',
         'Proteggi due blocchi da 60-90 minuti a settimana per il lavoro che richiede concentrazione.',
         'Rendi visibile la coda di lavoro a chi assegna i compiti: la priorità la deve fissare chi carica, non chi esegue.']);
    }

    /* --- dati oggettivi --- */

    if (m.datiSufficienti && m.giorniSenzaPausa >= 4) {
      push(2, 'Pause saltate',
        'Hai registrato ' + m.giorniSenzaPausa + ' giornate lunghe senza pausa. Le micro-pause non sono tempo perso: mantengono la prestazione nella seconda metà del turno.',
        ['Blocca la pausa in agenda come un appuntamento e allontanati fisicamente dalla postazione.',
         'Anche 5-10 minuti ogni 2 ore riducono l\'affaticamento accumulato; non serve una pausa lunga per averne il beneficio.']);
    }

    if (m.datiSufficienti && m.straordinari28 > 15) {
      push(2, 'Straordinari strutturali',
        m.straordinari28.toFixed(1).replace('.', ',') + ' ore di straordinario in quattro settimane non sono un picco, sono la norma del tuo carico.',
        ['Verifica che siano tutti registrati e retribuiti o recuperati: usa l\'esportazione CSV di questa app come traccia.',
         'Se lo straordinario copre una carenza di organico, il dato aggregato è l\'argomento più forte in una richiesta formale.']);
    }

    if (m.datiSufficienti && m.turniNotturni >= 4) {
      push(3, 'Turni serali e notturni',
        'Il lavoro fuori dalle ore diurne pesa sul ritmo circadiano anche quando il totale delle ore è nella norma.',
        ['Dopo un turno notturno: dormi appena possibile, in ambiente buio e fresco, ed evita di rimandare il sonno a fine giornata.',
         'Mantieni gli orari dei pasti il più regolari possibile: sono un secondo sincronizzatore del ritmo.',
         'Evita caffeina nelle ultime 5-6 ore del turno.']);
    }

    /* --- rinforzo positivo --- */

    if (out.length === 0) {
      push(3, 'Quadro equilibrato',
        'Né i dati dei tuoi turni né le risposte al questionario segnalano criticità rilevanti in questo momento.',
        ['Ripeti il check-in ogni 2-4 settimane: il valore sta nell\'andamento, non nella singola misurazione.',
         'Annota cosa sta funzionando adesso: è la base a cui tornare nei periodi più carichi.']);
    } else if (m.datiSufficienti && m.giorniRiposo28 >= 8 && m.mediaSettimanale <= 42) {
      push(3, 'Un elemento che funziona',
        'Il tuo ritmo di riposo (' + m.giorniRiposo28 + ' giorni liberi in 4 settimane, media di ' + m.mediaSettimanale.toFixed(1).replace('.', ',') + ' h/settimana) è un fattore protettivo reale. Proteggilo mentre lavori sugli altri punti.',
        []);
    }

    out.sort(function (a, b) { return a.priority - b.priority; });
    return out;
  }

  /* ---------- valutazione completa ---------- */

  function evaluate(answers, shifts, settings, refISO) {
    var m = workMetrics(shifts, settings, refISO);
    var obj = objectiveRisk(m);
    var subj = answers ? scoreAnswers(answers) : null;

    var score;
    if (subj && subj.answered > 0 && obj.score !== null) score = Math.round(subj.score * 0.65 + obj.score * 0.35);
    else if (subj && subj.answered > 0) score = subj.score;
    else score = obj.score;

    var level = levelFor(score || 0);

    return {
      score: score,
      level: level,
      subjective: subj,
      objective: obj,
      metrics: m,
      advice: advice(subj, m, obj)
    };
  }

  global.Coach = {
    SCALE: SCALE,
    QUESTIONS: QUESTIONS,
    DIMENSIONS: DIMENSIONS,
    LEVELS: LEVELS,
    levelFor: levelFor,
    scoreAnswers: scoreAnswers,
    workMetrics: workMetrics,
    objectiveRisk: objectiveRisk,
    evaluate: evaluate
  };
})(window);
