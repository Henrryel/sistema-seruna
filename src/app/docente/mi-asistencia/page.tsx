import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { ResumenAsistenciaPortal } from '@/components/asistencia/resumen-asistencia';

export const metadata: Metadata = { title: 'Mi asistencia' };

export default async function PaginaMiAsistenciaDocente() {
  const actor = await exigirPortalPagina('docente');
  return (
    <>
      <EncabezadoPagina titulo="Mi asistencia" descripcion="Sus jornadas, marcaciones de entrada y salida, y justificaciones." />
      <ResumenAsistenciaPortal
        endpoint="/api/docente/asistencia/mia"
        justificar={tienePermiso(actor, 'asistencia.justificar') ? { endpoint: '/api/docente/asistencia/justificaciones' } : null}
      />
    </>
  );
}
