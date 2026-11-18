import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCalendario } from './cliente';

export const metadata: Metadata = { title: 'Calendario escolar' };

export default async function PaginaCalendario() {
  await exigirPermisoPagina('academico.configurar');
  return <ClienteCalendario />;
}
