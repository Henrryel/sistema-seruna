import { ShellPortal } from '@/components/layout/shell-portal';
import { exigirPortalPagina } from '@/server/paginas';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await exigirPortalPagina('docente');
  return (
    <ShellPortal
      portal="docente"
      usuario={{ nombres: actor.nombres, apellidos: actor.apellidos, login: actor.login, permisos: actor.permisos, portales: actor.portales }}
    >
      {children}
    </ShellPortal>
  );
}