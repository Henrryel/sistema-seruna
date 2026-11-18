import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteEstudiantes } from './cliente';

export const metadata: Metadata = { title: 'Estudiantes' };

export default async function PaginaEstudiantes() {
  await exigirPermisoPagina('matriculas.gestionar');
  return <ClienteEstudiantes />;
}
