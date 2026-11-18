import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteReglas } from './cliente';

export const metadata: Metadata = { title: 'Reglas y requisitos de matrícula' };

export default async function PaginaReglas() {
  await exigirPermisoPagina('matriculas.gestionar');
  return <ClienteReglas />;
}
