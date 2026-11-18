import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteReportesCobros } from './cliente';

export const metadata: Metadata = { title: 'Morosidad y recaudación' };

export default async function PaginaReportesCobros() {
  await exigirPermisoPagina('reportes.tesoreria');
  return <ClienteReportesCobros />;
}
