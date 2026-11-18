import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { exigirPortalPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { ClienteCalificacionesDocente } from './cliente';

export const metadata: Metadata = { title: 'Calificaciones' };

export default async function PaginaCalificacionesDocente() {
  const actor = await exigirPortalPagina('docente');
  if (!tienePermiso(actor, 'academico.calificar')) redirect('/docente');
  return <ClienteCalificacionesDocente />;
}
