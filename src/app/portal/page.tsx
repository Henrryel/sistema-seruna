import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { exigirSesionPagina } from '@/server/paginas';
import { SelectorPortales } from './selector';

export const metadata: Metadata = { title: 'Seleccionar portal' };
export const dynamic = 'force-dynamic';

export default async function PaginaPortal() {
  const actor = await exigirSesionPagina();
  if (actor.portales.length === 1) redirect(`/${actor.portales[0]}`);
  return (
    <main id="contenido" className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-xl font-semibold">Hola, {actor.nombres}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {actor.portales.length ? '¿A qué portal desea ingresar?' : 'Su cuenta todavía no tiene un perfil asignado. Comuníquese con el colegio.'}
        </p>
        <SelectorPortales portales={actor.portales} />
      </div>
    </main>
  );
}
