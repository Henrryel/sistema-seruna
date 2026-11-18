import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCredenciales } from './cliente';

export const metadata: Metadata = { title: 'Credenciales y carnets' };

export default async function PaginaCredenciales() {
  await exigirPermisoPagina('asistencia.configurar');
  return <ClienteCredenciales />;
}
