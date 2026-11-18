import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { exigirPortalPagina, hijoSeleccionado } from '@/server/paginas';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { ResumenEstudiante } from '@/components/dashboard/resumen-estudiante';
import { AccesosRapidos } from '@/components/dashboard/accesos-rapidos';

export const metadata: Metadata = { title: 'Resumen familiar' };

export default async function PaginaInicioPadre() {
  const actor = await exigirPortalPagina('padre');
  const { hijos, hijo } = await hijoSeleccionado(actor);

  if (!hijo) {
    return (
      <div className="grid gap-6">
        <EncabezadoPagina className="mb-0 sm:mb-0" titulo={`Hola, ${actor.nombres}`} />
        <EstadoVacio
          icono={<Users className="size-8" aria-hidden />}
          titulo="No tiene estudiantes vinculados"
          descripcion="Su cuenta no tiene hoy un vínculo vigente con ningún estudiante. Acérquese a secretaría para verificar sus datos de apoderado."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo={`Hola, ${actor.nombres}`}
        descripcion={
          hijos.length > 1
            ? `Resumen de ${hijo.nombres}. Cambie de hijo o hija con el selector de la parte superior.`
            : `Resumen de ${hijo.nombres} ${hijo.apellidos}.`
        }
      />
      <ResumenEstudiante key={hijo.estudianteId} endpoint={`/api/padre/inicio?estudianteId=${hijo.estudianteId}`} portal="padre" />
      <AccesosRapidos portal="padre" permisos={actor.permisos} />
    </div>
  );
}
