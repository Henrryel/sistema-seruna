import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteContratos } from './cliente';

export const metadata: Metadata = { title: 'Docentes y contratos' };

export default async function PaginaContratos() {
  await exigirPermisoPagina('planilla.contratos');
  return <ClienteContratos />;
}
