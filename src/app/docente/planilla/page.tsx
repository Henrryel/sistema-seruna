import type { Metadata } from 'next';
import { exigirPortalPagina } from '@/server/paginas';
import { ClientePlanillaDocente } from './cliente';

export const metadata: Metadata = { title: 'Mi planilla' };

export default async function PaginaPlanillaDocente() {
  await exigirPortalPagina('docente');
  return <ClientePlanillaDocente />;
}
