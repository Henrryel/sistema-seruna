import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { ResumenEstudiante } from '@/components/dashboard/resumen-estudiante';
import { AccesosRapidos } from '@/components/dashboard/accesos-rapidos';

export const metadata: Metadata = { title: 'Inicio' };

export default async function PaginaInicioEstudiante() {
  const actor = await exigirPortalPagina('estudiante');
  return (
    <div className="grid gap-6">
      <EncabezadoPagina className="mb-0 sm:mb-0" titulo={`Hola, ${actor.nombres}`} descripcion="Tus logros, tu asistencia del mes y tus pagos." />
      <ResumenEstudiante endpoint="/api/estudiante/inicio" portal="estudiante" />
      <AccesosRapidos portal="estudiante" permisos={actor.permisos} />
    </div>
  );
}
