import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteMerito } from './cliente';

export const metadata: Metadata = { title: 'Orden de mérito' };

export default async function PaginaMerito() {
  await exigirPermisoPagina('academico.publicar_merito');
  return <ClienteMerito />;
}
