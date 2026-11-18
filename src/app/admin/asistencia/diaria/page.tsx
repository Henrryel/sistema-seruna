import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteAsistenciaDiaria } from './cliente';

export const metadata: Metadata = { title: 'Asistencia diaria' };

export default async function PaginaAsistenciaDiaria() {
  await exigirPermisoPagina('asistencia.registrar');
  return <ClienteAsistenciaDiaria />;
}
