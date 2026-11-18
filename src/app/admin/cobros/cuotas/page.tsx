import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCuotas } from './cliente';

export const metadata: Metadata = { title: 'Cuotas' };

export default async function PaginaCuotas() {
  await exigirPermisoPagina('tesoreria.cobrar');
  return <ClienteCuotas />;
}
