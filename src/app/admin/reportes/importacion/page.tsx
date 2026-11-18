import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteImportacion } from '@/components/importacion/cliente';

export const metadata: Metadata = { title: 'Importación histórica' };

export default async function PaginaImportacion() {
  await exigirPermisoPagina('datos.conciliar_historico');
  return <ClienteImportacion />;
}
