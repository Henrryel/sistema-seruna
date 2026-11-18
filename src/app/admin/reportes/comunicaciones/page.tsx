import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { PERMISOS_COMUNICACIONES } from '@/esquemas/reportes/documentos';
import { ClienteComunicaciones } from '@/components/reportes/comunicaciones';

export const metadata: Metadata = { title: 'Comunicación de documentos' };

export default async function PaginaComunicaciones() {
  await exigirPermisoPagina(PERMISOS_COMUNICACIONES);
  return <ClienteComunicaciones />;
}
