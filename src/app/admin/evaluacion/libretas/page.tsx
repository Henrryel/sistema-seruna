import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteLibretas } from './cliente';

export const metadata: Metadata = { title: 'Libretas' };

export default async function PaginaLibretas() {
  await exigirPermisoPagina(['reportes.academico', 'academico.publicar']);
  return <ClienteLibretas />;
}
