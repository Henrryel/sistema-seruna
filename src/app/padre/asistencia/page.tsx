import type { Metadata } from 'next';
import { exigirPortalPagina, hijoSeleccionado } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { EncabezadoPagina, EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { ResumenAsistenciaPortal } from '@/components/asistencia/resumen-asistencia';

export const metadata: Metadata = { title: 'Asistencia' };

export default async function PaginaAsistenciaPadre() {
  const actor = await exigirPortalPagina('padre');
  const { hijo } = await hijoSeleccionado(actor);
  if (!hijo) return <EstadoVacio titulo="Sin estudiantes vinculados" descripcion="No tiene un vínculo vigente con ningún estudiante." />;
  const nombre = `${hijo.nombres} ${hijo.apellidos}`;
  return (
    <>
      <EncabezadoPagina titulo={`Asistencia de ${nombre}`} descripcion="Resumen, detalle diario y por clase. Puede solicitar la justificación de faltas y tardanzas." />
      {hijo.accesoAcademico ? (
        <ResumenAsistenciaPortal
          key={hijo.estudianteId}
          endpoint="/api/padre/asistencia"
          parametros={{ estudianteId: hijo.estudianteId }}
          justificar={tienePermiso(actor, 'asistencia.justificar') ? { endpoint: '/api/padre/asistencia/justificaciones' } : null}
          sujeto={nombre}
        />
      ) : (
        <SinPermiso mensaje="No tiene autorizado el acceso a la información académica de este estudiante." />
      )}
    </>
  );
}
