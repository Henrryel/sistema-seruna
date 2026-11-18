import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Proveedores } from '@/components/proveedores';

export const metadata: Metadata = {
  title: { default: 'SERUNA · Gestión Escolar', template: '%s · SERUNA' },
  description: 'Sistema de Gestión Escolar — Primaria y Secundaria',
  applicationName: 'SERUNA',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#16181f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" suppressHydrationWarning>
      <body className="min-h-dvh">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
          Saltar al contenido
        </a>
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
