import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteRecuperacion } from './cliente';

export const metadata: Metadata = { title: 'Recuperación' };

export default async function PaginaRecuperacion() {
  await exigirPermisoPagina('academico.recuperacion');
  return <ClienteRecuperacion />;
}
