import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteHorarios } from './cliente';

export const metadata: Metadata = { title: 'Horarios y sesiones' };

export default async function PaginaHorarios() {
  await exigirPermisoPagina('academico.configurar');
  return <ClienteHorarios />;
}
