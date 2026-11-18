import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCaja } from './cliente';

export const metadata: Metadata = { title: 'Caja' };

export default async function PaginaCaja() {
  await exigirPermisoPagina('tesoreria.cobrar');
  return <ClienteCaja />;
}
