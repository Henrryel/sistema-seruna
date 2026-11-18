import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { exigirPortalPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { bloquesPermitidos } from '@/server/services/dashboard/admin';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { PanelAdmin } from '@/components/dashboard/panel-admin';
import { AccesosRapidos } from '@/components/dashboard/accesos-rapidos';

export const metadata: Metadata = { title: 'Panel' };

export default async function PaginaPanelAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPortalPagina('admin');
  const sinPermiso = (await searchParams).sinPermiso === '1';
  const conIndicadores = bloquesPermitidos(actor).length > 0;

  return (
    <div className="grid gap-6">
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo={`Hola, ${actor.nombres}`}
        descripcion={conIndicadores ? 'Indicadores institucionales del año académico.' : 'Elija una de las opciones disponibles para su cuenta.'}
      />
      {sinPermiso ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-alerta-foreground/30 bg-alerta px-3 py-2 text-sm text-alerta-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>No tiene permiso para abrir la pantalla solicitada. Si lo necesita, pida el acceso al administrador del sistema.</span>
        </div>
      ) : null}
      {conIndicadores ? <PanelAdmin puedeExportar={tienePermiso(actor, 'reportes.dashboard')} /> : null}
      <AccesosRapidos portal="admin" permisos={actor.permisos} titulo={conIndicadores ? 'Accesos rápidos' : 'Sus opciones'} limite={conIndicadores ? 8 : undefined} />
    </div>
  );
}
