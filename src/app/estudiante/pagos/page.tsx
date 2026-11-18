import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { ClientePagosEstudiante } from './cliente';

export const metadata: Metadata = { title: 'Mis pagos' };

export default async function PaginaPagosEstudiante() {
  await exigirPortalPagina('estudiante');
  return <ClientePagosEstudiante />;
}
