import type { Metadata } from 'next';
import { exigirPortalPagina, hijoSeleccionado } from '@/server/paginas';
import { EncabezadoPagina, EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { ClienteNotasPadre } from './cliente';

export const metadata: Metadata = { title: 'Logros' };

export default async function PaginaNotasPadre() {
  const actor = await exigirPortalPagina('padre');
  const { hijo } = await hijoSeleccionado(actor);
  if (!hijo) {
    return (
      <>
        <EncabezadoPagina titulo="Logros de aprendizaje" />
        <EstadoVacio titulo="Sin estudiantes vinculados" descripcion="No tiene un vínculo vigente con ningún estudiante." />
      </>
    );
  }
  if (!hijo.accesoAcademico) {
    return (
      <>
        <EncabezadoPagina titulo={`Logros de ${hijo.nombres}`} />
        <SinPermiso mensaje="No tiene autorizado el acceso a la información académica de este estudiante. Consulte con la institución." />
      </>
    );
  }
  return <ClienteNotasPadre estudianteId={hijo.estudianteId} nombre={hijo.nombres} />;
}
