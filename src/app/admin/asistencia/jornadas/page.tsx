import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteJornadas } from './cliente';

export const metadata: Metadata = { title: 'Políticas y jornadas' };

export default async function PaginaJornadas() {
  await exigirPermisoPagina('asistencia.configurar');
  return <ClienteJornadas />;
}
