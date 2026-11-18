import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClientePlanes } from './cliente';

export const metadata: Metadata = { title: 'Planes de cobro' };

export default async function PaginaPlanes() {
  await exigirPermisoPagina('tesoreria.cobrar');
  return <ClientePlanes />;
}
