/* SERUNA · Service worker del escáner de asistencia.
 *
 * Se registra con scope '/escaner' (solo controla esa página). Cachea el "shell" del escáner para poder
 * abrirlo sin conexión: el HTML de /escaner (red primero, copia en caché), los recursos estáticos de Next
 * (/_next/static, inmutables con hash: caché primero), el manifiesto y los íconos.
 * NUNCA cachea /api/**: las lecturas sin conexión van a la cola de IndexedDB del propio escáner y se
 * sincronizan al reconectar (POST /api/escaner/sincronizar).
 */
const VERSION = 'seruna-escaner-v1';
const SHELL = '/escaner';
const ESTATICOS = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg'];

/** Guarda solo respuestas propias, completas y sin redirección (p. ej. no guardar /login como /escaner). */
function cacheable(res) {
  return res && res.ok && res.status === 200 && !res.redirected && res.type === 'basic';
}

async function precargar() {
  const cache = await caches.open(VERSION);
  await Promise.all(
    [SHELL, ...ESTATICOS].map(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        if (cacheable(res)) await cache.put(url, res);
      } catch {
        /* sin conexión durante la instalación: se cacheará en la próxima visita */
      }
    }),
  );
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(precargar().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c.startsWith('seruna-escaner-') && c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

async function redPrimeroShell(peticion) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(peticion);
    if (cacheable(res)) await cache.put(SHELL, res.clone());
    return res;
  } catch {
    const copia = await cache.match(SHELL);
    if (copia) return copia;
    return new Response(
      '<!doctype html><html lang="es-PE"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title>' +
        '<body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Sin conexión</h1><p>Abra el escáner al menos una vez con conexión para usarlo sin ella.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cachePrimero(peticion) {
  const cache = await caches.open(VERSION);
  const copia = await cache.match(peticion);
  if (copia) return copia;
  const res = await fetch(peticion);
  if (cacheable(res)) await cache.put(peticion, res.clone());
  return res;
}

async function redConRespaldo(peticion) {
  try {
    return await fetch(peticion);
  } catch (e) {
    const copia = await caches.match(peticion);
    if (copia) return copia;
    throw e;
  }
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (peticion.mode === 'navigate' && url.pathname === SHELL) {
    evento.respondWith(redPrimeroShell(peticion));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    evento.respondWith(cachePrimero(peticion));
    return;
  }
  evento.respondWith(redConRespaldo(peticion));
});
