import type { Metadata } from 'next';
import { exigirPortalPagina, hijoSeleccionado } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { EncabezadoPagina, EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { ResumenAsistenciaPortal } from '@/components/asistencia/resumen-asistencia';

export const metadata: Metadata = { title: 'Justificaciones' };

export default async function PaginaJustificacionesPadre() {
  const actor = await exigirPortalPagina('padre');
  const { hijo } = await hijoSeleccionado(actor);
  if (!hijo) return <EstadoVacio titulo="Sin estudiantes vinculados" descripcion="No tiene un vínculo vigente con ningún estudiante." />;
  const nombre = `${hijo.nombres} ${hijo.apellidos}`;
  return (
    <>
      <EncabezadoPagina
        titulo={`Justificaciones de ${nombre}`}
        descripcion="Solicite la justificación de una inasistencia o tardanza y revise el estado de sus solicitudes."
      />
      {hijo.accesoAcademico ? (
        <ResumenAsistenciaPortal
          key={hijo.estudianteId}
          vista="justificaciones"
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
