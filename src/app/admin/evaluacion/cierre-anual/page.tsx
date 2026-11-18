import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCierreAnual } from './cliente';

export const metadata: Metadata = { title: 'Cierre anual' };

export default async function PaginaCierreAnual() {
  await exigirPermisoPagina('academico.cerrar_anio');
  return <ClienteCierreAnual />;
}
