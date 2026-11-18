import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteSecciones } from './cliente';

export const metadata: Metadata = { title: 'Secciones y aulas' };

export default async function PaginaSecciones() {
  await exigirPermisoPagina('academico.configurar');
  return <ClienteSecciones />;
}
