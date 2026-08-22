// Service worker minimal : rend le site "installable" comme une application,
// et garde juste l'enveloppe du site (page + icônes) disponible hors-ligne.
// Le contenu (histoires, chapitres...) reste chargé en direct depuis Supabase :
// il faut donc une connexion pour lire, comme avant. Ce fichier ne fait QUE
// permettre l'installation sur l'écran d'accueil et un chargement plus rapide.

const CACHE_NAME = 'cordelia-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // On ne touche jamais aux appels vers Supabase (données en direct) : uniquement
  // l'enveloppe statique du site (page, icônes) passe par le cache.
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
