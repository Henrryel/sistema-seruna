import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteJustificaciones } from './cliente';

export const metadata: Metadata = { title: 'Justificaciones' };

export default async function PaginaJustificaciones() {
  await exigirPermisoPagina('asistencia.resolver');
  return <ClienteJustificaciones />;
}
