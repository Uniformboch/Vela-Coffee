// Service worker del menú: permite instalarlo como app y abrirlo sin conexión.
// Siempre intenta primero la red (para ver precios y agotados al día) y usa la copia guardada solo si no hay internet.
const CACHE = 'vela-menu-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre !== CACHE) await caches.delete(nombre);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const { request } = evento;
  const url = new URL(request.url);
  // Ni el panel ni la API pasan por aquí.
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  evento.respondWith((async () => {
    try {
      const respuesta = await fetch(request);
      if (respuesta.ok) {
        const copia = respuesta.clone();
        caches.open(CACHE).then(c => c.put(request, copia)).catch(() => {});
      }
      return respuesta;
    } catch (error) {
      const guardada = await caches.match(request, { ignoreSearch: true });
      if (guardada) return guardada;
      throw error;
    }
  })());
});
