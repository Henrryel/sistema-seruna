import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { ResumenAsistenciaPortal } from '@/components/asistencia/resumen-asistencia';

export const metadata: Metadata = { title: 'Mi asistencia' };

export default async function PaginaAsistenciaEstudiante() {
  const actor = await exigirPortalPagina('estudiante');
  const puedeJustificar = tienePermiso(actor, 'asistencia.justificar');
  return (
    <>
      <EncabezadoPagina
        titulo="Mi asistencia"
        descripcion={puedeJustificar ? 'Resumen y detalle. Puede solicitar la justificación de una falta o tardanza.' : 'Resumen y detalle de su asistencia.'}
      />
      <ResumenAsistenciaPortal endpoint="/api/estudiante/asistencia" justificar={puedeJustificar ? { endpoint: '/api/estudiante/asistencia/justificaciones' } : null} />
    </>
  );
}
