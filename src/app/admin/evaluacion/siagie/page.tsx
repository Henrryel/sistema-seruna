import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteSiagie } from './cliente';

export const metadata: Metadata = { title: 'Exportación SIAGIE' };

export default async function PaginaSiagie() {
  await exigirPermisoPagina('academico.exportar_siagie');
  return <ClienteSiagie />;
}
