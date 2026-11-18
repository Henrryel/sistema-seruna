import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { ClientePagos } from './cliente';

export const metadata: Metadata = { title: 'Pagos y recibos' };

export default async function PaginaPagos() {
  const actor = await exigirPermisoPagina(['tesoreria.cobrar', 'tesoreria.revertir']);
  return <ClientePagos puedeCobrar={tienePermiso(actor, 'tesoreria.cobrar')} puedeRevertir={tienePermiso(actor, 'tesoreria.revertir')} />;
}
