import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCurriculo } from './cliente';

export const metadata: Metadata = { title: 'Currículo CNEB' };

export default async function PaginaCurriculo() {
  await exigirPermisoPagina('academico.configurar');
  return <ClienteCurriculo />;
}
