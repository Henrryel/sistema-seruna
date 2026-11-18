import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { ClienteNotasEstudiante } from './cliente';

export const metadata: Metadata = { title: 'Mis logros' };

export default async function PaginaNotasEstudiante() {
  await exigirPortalPagina('estudiante');
  return <ClienteNotasEstudiante />;
}
