import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteMatriculas } from './cliente';

export const metadata: Metadata = { title: 'Matrículas' };

export default async function PaginaMatriculas() {
  await exigirPermisoPagina('matriculas.gestionar');
  return <ClienteMatriculas />;
}
