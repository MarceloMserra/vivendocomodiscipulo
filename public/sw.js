// O "Cérebro" do PWA (Service Worker)

// Instalação
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalado');
  self.skipWaiting();
});

// Ativação
self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Ativado');
  return self.clients.claim();
});

// Interceptação de Rede (Básico para funcionar)
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});