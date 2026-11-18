import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteLectores } from './cliente';

export const metadata: Metadata = { title: 'Lectores QR' };

export default async function PaginaLectores() {
  await exigirPermisoPagina('asistencia.configurar');
  return <ClienteLectores />;
}
