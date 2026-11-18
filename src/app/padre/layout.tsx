import { ShellPortal } from '@/components/layout/shell-portal';
import { exigirPortalPagina, hijoSeleccionado } from '@/server/paginas';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await exigirPortalPagina('padre');
  const { hijos, hijo } = await hijoSeleccionado(actor);
  return (
    <ShellPortal
      portal="padre"
      usuario={{ nombres: actor.nombres, apellidos: actor.apellidos, login: actor.login, permisos: actor.permisos, portales: actor.portales }}
      hijos={hijos.map((h) => ({ estudianteId: h.estudianteId, nombres: h.nombres, apellidos: h.apellidos }))}
      hijoActual={hijo?.estudianteId ?? null}
    >
      {children}
    </ShellPortal>
  );
}