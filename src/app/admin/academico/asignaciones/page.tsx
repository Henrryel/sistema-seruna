import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteAsignaciones } from './cliente';

export const metadata: Metadata = { title: 'Cursos y docentes' };

export default async function PaginaAsignaciones() {
  await exigirPermisoPagina('academico.configurar');
  return <ClienteAsignaciones />;
}
