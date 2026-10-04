/**
 * Service Worker - Apuração Eleitoral Brasil 2026 PWA
 * Gerencia cache do App Shell e permite instalação nativa no Android e iOS.
 */

const CACHE_NAME = "tse-apuracao-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/mobile",
  "/mobile.html",
  "/css/style.css",
  "/css/mobile.css",
  "/js/app.js",
  "/js/mobile.js",
  "/js/map-data.js",
  "/data/geo-data.js",
  "/manifest.json",
  "/favicon.ico",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/maskable-icon-512.png"
];

// Instalação do Service Worker e pré-carregamento do App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de Fetch:
// - Requisições da API (/api/): Network-First (dados eleitorais sempre frescos, fallback cache)
// - Arquivos estáticos (HTML/CSS/JS/Imagens): Cache-First com atualização em background
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Não intercepta chamadas SSE (/api/events)
  if (url.pathname.includes("/api/events")) {
    return;
  }

  // API REST: Network-First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Estáticos: Cache-First com revalidação
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Atualiza em background
        fetch(event.request)
          .then((networkResp) => {
            if (networkResp && networkResp.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResp));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
