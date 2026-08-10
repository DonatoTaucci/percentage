/* sw.js — cache offline.

   Strategia: network-first per tutto ciò che è codice o configurazione
   (HTML, CSS, JS, manifest), cache-first solo per le immagini.

   Il codice è servito dalla rete di proposito. Con la strategia opposta
   una modifica al sito restava invisibile finché non cambiava il nome
   della cache: è successo con la chiave di Clerk in js/config.js, che i
   browser hanno continuato a leggere vuota dopo che era stata aggiunta.
   Sono file di pochi kB: quando la rete c'è, riprenderli costa poco;
   quando non c'è, la copia in cache resta e il sito funziona offline. */
var CACHE = 'percentage-v5';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/config.js',
  './js/i18n.js',
  './js/lang/en.js',
  './js/lang/es.js',
  './js/lang/fr.js',
  './js/lang/de.js',
  './js/store.js',
  './js/calc.js',
  './js/charts.js',
  './js/coach.js',
  './js/geo.js',
  './js/ai.js',
  './js/ui.js',
  './js/app.js',
  './js/cloud.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// La pagina chiede quale versione la sta servendo: è l'unico modo, dall'esterno,
// di distinguere "il sito è aggiornato" da "il browser mostra una copia vecchia".
self.addEventListener('message', function (e) {
  if (e.data === 'versione' && e.source) e.source.postMessage({ tipo: 'versione', cache: CACHE });
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // niente cache per l'API di Claude

  var aggiorna = function (res) {
    if (res && res.status === 200 && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  };

  // Codice e configurazione: prima la rete, la cache è la riserva per l'offline.
  if (req.mode === 'navigate' || /\.(html|css|js|mjs|webmanifest|json)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(aggiorna).catch(function () {
        return caches.match(req).then(function (r) {
          if (r) return r;
          return req.mode === 'navigate' ? caches.match('./index.html') : Response.error();
        });
      })
    );
    return;
  }

  // Immagini e resto: prima la cache, sono file che non cambiano.
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(aggiorna);
    })
  );
});
