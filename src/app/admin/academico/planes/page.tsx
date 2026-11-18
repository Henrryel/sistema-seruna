import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClientePlanes } from './cliente';

export const metadata: Metadata = { title: 'Planes de estudio' };

export default async function PaginaPlanes() {
  await exigirPermisoPagina('academico.configurar');
  return <ClientePlanes />;
}
