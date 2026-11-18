import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { InicioDocentePanel } from '@/components/dashboard/inicio-docente';
import { AccesosRapidos } from '@/components/dashboard/accesos-rapidos';

export const metadata: Metadata = { title: 'Inicio docente' };

export default async function PaginaInicioDocente() {
  const actor = await exigirPortalPagina('docente');
  return (
    <div className="grid gap-6">
      <EncabezadoPagina className="mb-0 sm:mb-0" titulo={`Hola, ${actor.nombres}`} descripcion="Sus clases de hoy y las calificaciones por completar." />
      <InicioDocentePanel />
      <AccesosRapidos portal="docente" permisos={actor.permisos} />
    </div>
  );
}
