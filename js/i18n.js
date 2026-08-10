/* i18n.js — traduzione dell'interfaccia.

   La chiave di ogni voce è il testo italiano. Due conseguenze pratiche:
   l'italiano non ha bisogno di dizionario e non può andare fuori sincrono,
   e una traduzione mancante mostra l'originale invece di una sigla tecnica.
   Il prezzo è che cambiare una frase italiana invalida le sue traduzioni,
   che vanno aggiornate: controllabile con `node scripts/controlla-lingue.mjs`.

   I dizionari sono file separati caricati su richiesta e precaricati dal
   service worker, così cambiare lingua funziona anche offline. */
(function (global) {
  'use strict';

  var LINGUE = [
    { code: 'it', nome: 'Italiano', bandiera: '🇮🇹' },
    { code: 'en', nome: 'English', bandiera: '🇬🇧' },
    { code: 'es', nome: 'Español', bandiera: '🇪🇸' },
    { code: 'fr', nome: 'Français', bandiera: '🇫🇷' },
    { code: 'de', nome: 'Deutsch', bandiera: '🇩🇪' }
  ];
  var CHIAVE = 'percentage.lingua';
  var codici = LINGUE.map(function (l) { return l.code; });

  global.I18N = global.I18N || {};   // qui i dizionari si registrano da soli

  /* Lingua iniziale: la scelta salvata, altrimenti quella del browser se la
     conosciamo, altrimenti italiano. */
  function iniziale() {
    try {
      var salvata = localStorage.getItem(CHIAVE);
      if (salvata && codici.indexOf(salvata) >= 0) return salvata;
    } catch (e) { /* localStorage negato: si prosegue col browser */ }
    var nav = (navigator.languages || [navigator.language || 'it'])[0] || 'it';
    var breve = String(nav).slice(0, 2).toLowerCase();
    return codici.indexOf(breve) >= 0 ? breve : 'it';
  }

  var corrente = iniziale();
  var ascoltatori = [];
  var inCaricamento = {};

  function dizionario() { return global.I18N[corrente] || null; }

  /* T('testo') oppure T('{n} turni', { n: 3 }) */
  function T(testo, valori) {
    var d = dizionario();
    var out = (d && d[testo]) || testo;
    if (valori) {
      out = out.replace(/\{(\w+)\}/g, function (intero, nome) {
        return Object.prototype.hasOwnProperty.call(valori, nome) ? String(valori[nome]) : intero;
      });
    }
    return out;
  }

  /* ---------------- traduzione del testo già composto ----------------

     L'interfaccia costruisce le frasi concatenando pezzi: 'Sei a ' + d +
     ' dal punto salvato'. Tradurre i pezzi singolarmente è impossibile,
     perché l'ordine delle parole cambia da lingua a lingua. Qui si traduce
     invece il risultato, quando la frase è di nuovo intera: i numeri
     diventano segnaposto ({0}, {1}) e la traduzione può rimetterli dove
     servono. Ciò che non è nel dizionario resta com'è, in italiano. */

  var SALTA_TAG = { SCRIPT: 1, STYLE: 1, CODE: 1, TEXTAREA: 1, KBD: 1 };
  var ATTRIBUTI = ['title', 'aria-label', 'placeholder'];
  var NUMERO = /\d+(?:[.,:]\d+)*/g;

  function scomponi(testo) {
    var numeri = [];
    var chiave = testo.replace(NUMERO, function (n) {
      numeri.push(n);
      return '{' + (numeri.length - 1) + '}';
    });
    return { chiave: chiave.replace(/\s+/g, ' ').trim(), numeri: numeri };
  }

  function ricomponi(tradotto, numeri) {
    return tradotto.replace(/\{(\d+)\}/g, function (intero, i) {
      return numeri[+i] !== undefined ? numeri[+i] : intero;
    });
  }

  function traduciTesto(testo, d) {
    var parti = scomponi(testo);
    if (!parti.chiave) return null;
    var tradotto = d[parti.chiave];
    if (!tradotto) return null;
    // Gli spazi ai bordi vanno conservati: separano le parole dai tag vicini.
    var apertura = /^\s*/.exec(testo)[0];
    var chiusura = /\s*$/.exec(testo)[0];
    return apertura + ricomponi(tradotto, parti.numeri) + chiusura;
  }

  function saltare(nodo) {
    for (var el = nodo.parentElement; el; el = el.parentElement) {
      if (SALTA_TAG[el.tagName]) return true;
      // Le note dei turni e i messaggi dell'assistente sono testi
      // dell'utente: tradurli sarebbe una manomissione.
      if (el.hasAttribute && el.hasAttribute('data-no-i18n')) return true;
    }
    return false;
  }

  function traduciDOM(radice) {
    if (corrente === 'it') return;
    var d = dizionario();
    if (!d || !radice) return;

    var camminatore = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT, null);
    var nodi = [];
    while (camminatore.nextNode()) nodi.push(camminatore.currentNode);
    nodi.forEach(function (n) {
      if (!n.nodeValue || !/[A-Za-zÀ-ÿ]/.test(n.nodeValue)) return;
      if (saltare(n)) return;
      var t = traduciTesto(n.nodeValue, d);
      if (t !== null) n.nodeValue = t;
    });

    ATTRIBUTI.forEach(function (attr) {
      var sel = radice.querySelectorAll ? radice.querySelectorAll('[' + attr + ']') : [];
      Array.prototype.forEach.call(sel, function (el) {
        if (el.closest('[data-no-i18n]')) return;
        var t = traduciTesto(el.getAttribute(attr), d);
        if (t !== null) el.setAttribute(attr, t);
      });
    });
  }

  function carica(code) {
    if (code === 'it' || global.I18N[code]) return Promise.resolve();
    if (inCaricamento[code]) return inCaricamento[code];
    inCaricamento[code] = new Promise(function (risolvi) {
      var s = document.createElement('script');
      s.src = 'js/lang/' + code + '.js';
      // Un dizionario che non arriva non è motivo per bloccare l'app:
      // si resta sull'italiano, che è sempre presente nel codice.
      s.onload = function () { risolvi(); };
      s.onerror = function () { risolvi(); };
      document.head.appendChild(s);
    });
    return inCaricamento[code];
  }

  function imposta(code) {
    if (codici.indexOf(code) < 0) return Promise.resolve(corrente);
    return carica(code).then(function () {
      corrente = code;
      try { localStorage.setItem(CHIAVE, code); } catch (e) { /* ignorato */ }
      document.documentElement.setAttribute('lang', code);
      ascoltatori.forEach(function (fn) { fn(code); });
      return code;
    });
  }

  document.documentElement.setAttribute('lang', corrente);

  global.I18n = {
    lingue: LINGUE,
    lingua: function () { return corrente; },
    info: function () {
      return LINGUE.filter(function (l) { return l.code === corrente; })[0] || LINGUE[0];
    },
    imposta: imposta,
    precarica: function () { return carica(corrente); },
    onChange: function (fn) { ascoltatori.push(fn); },
    traduciDOM: traduciDOM,
    chiaveDi: function (testo) { return scomponi(testo).chiave; },
    T: T
  };
  global.T = T;
})(window);
