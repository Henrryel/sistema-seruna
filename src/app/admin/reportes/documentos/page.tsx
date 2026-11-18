import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { PERMISOS_REPORTES } from '@/esquemas/reportes/documentos';
import { ClienteDocumentos } from '@/components/reportes/documentos';

export const metadata: Metadata = { title: 'Reportes y documentos' };

export default async function PaginaDocumentos() {
  await exigirPermisoPagina(PERMISOS_REPORTES);
  return <ClienteDocumentos />;
}
