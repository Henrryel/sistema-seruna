import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteAnios } from './cliente';

export const metadata: Metadata = { title: 'Años y bimestres' };

export default async function PaginaAnios() {
  await exigirPermisoPagina('academico.configurar');
  return <ClienteAnios />;
}
