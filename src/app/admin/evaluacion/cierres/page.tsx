import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCierres } from './cliente';

export const metadata: Metadata = { title: 'Cierres de bimestre' };

export default async function PaginaCierres() {
  await exigirPermisoPagina('academico.publicar');
  return <ClienteCierres />;
}
