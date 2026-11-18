import type { Metadata } from 'next';
import { exigirPortalPagina, hijoSeleccionado } from '@/server/paginas';
import { EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { ClientePagosPadre } from './cliente';

export const metadata: Metadata = { title: 'Pagos' };

export default async function PaginaPagosPadre() {
  const actor = await exigirPortalPagina('padre');
  const { hijo } = await hijoSeleccionado(actor);
  if (!hijo) return <EstadoVacio titulo="Sin hijos vinculados" descripcion="No tiene estudiantes con vínculo vigente." />;
  if (!hijo.accesoEconomico) {
    return <SinPermiso mensaje={`No tiene autorizado el acceso a la información de pagos de ${hijo.nombres}. Solicítelo en secretaría.`} />;
  }
  return <ClientePagosPadre estudianteId={hijo.estudianteId} />;
}
