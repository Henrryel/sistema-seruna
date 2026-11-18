import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCobrar } from './cliente';

export const metadata: Metadata = { title: 'Cobrar' };

export default async function PaginaCobrar() {
  await exigirPermisoPagina('tesoreria.cobrar');
  return <ClienteCobrar />;
}
