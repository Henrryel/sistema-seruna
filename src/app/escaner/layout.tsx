import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { exigirSesionPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Escáner de asistencia',
  appleWebApp: { capable: true, title: 'SERUNA Escáner', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#2f3d8f' };

/** Página propia a pantalla completa, fuera de los portales. Exige `asistencia.marcar`. */
export default async function LayoutEscaner({ children }: { children: React.ReactNode }) {
  const actor = await exigirSesionPagina();
  if (!tienePermiso(actor, 'asistencia.marcar')) redirect('/portal');
  return (
    <main id="contenido" className="min-h-dvh bg-background text-foreground">
      {children}
    </main>
  );
}
