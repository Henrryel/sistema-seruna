import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { SinPermiso } from '@/components/datos/basicos';
import { ClienteAsistenciaDocente } from './cliente';

export const metadata: Metadata = { title: 'Asistencia' };

export default async function PaginaAsistenciaDocente() {
  const actor = await exigirPortalPagina('docente');
  if (!tienePermiso(actor, 'asistencia.registrar')) return <SinPermiso mensaje="Su cuenta no tiene el permiso para registrar asistencia." />;
  return <ClienteAsistenciaDocente />;
}
