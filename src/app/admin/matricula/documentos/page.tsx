import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteDocumentos } from './cliente';

export const metadata: Metadata = { title: 'Documentos institucionales' };

export default async function PaginaDocumentos() {
  await exigirPermisoPagina('matriculas.gestionar');
  return <ClienteDocumentos />;
}
