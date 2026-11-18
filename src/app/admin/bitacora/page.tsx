import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteBitacora } from './cliente';

export const metadata: Metadata = { title: 'Bitácora' };

export default async function PaginaBitacora() {
  await exigirPermisoPagina('usuarios.gestionar');
  return <ClienteBitacora />;
}
