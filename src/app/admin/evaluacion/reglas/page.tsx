import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteReglas } from './cliente';

export const metadata: Metadata = { title: 'Reglas de evaluación' };

export default async function PaginaReglas() {
  await exigirPermisoPagina('academico.configurar_cierre_anual');
  return <ClienteReglas />;
}
