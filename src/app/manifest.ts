import type { MetadataRoute } from 'next';

/**
 * Manifiesto PWA (enlazado por el layout raíz como /manifest.webmanifest).
 * La app instalable arranca en el escáner de puerta, que funciona sin conexión gracias a public/sw.js
 * (cachea su shell) y a la cola offline en IndexedDB. Si quien la abre no tiene `asistencia.marcar`,
 * el escáner lo redirige a su portal.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SERUNA · Gestión Escolar',
    short_name: 'SERUNA',
    description: 'Gestión escolar y escáner de asistencia con QR y código de barras (funciona sin conexión).',
    lang: 'es-PE',
    dir: 'ltr',
    start_url: '/escaner',
    scope: '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#2f3d8f',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Escáner de asistencia', short_name: 'Escáner', url: '/escaner', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Mi portal', short_name: 'Portal', url: '/portal', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
