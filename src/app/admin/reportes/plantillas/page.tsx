import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClientePlantillas } from '@/components/reportes/plantillas';

export const metadata: Metadata = { title: 'Plantillas de documento' };

export default async function PaginaPlantillas() {
  await exigirPermisoPagina('reportes.configurar');
  return <ClientePlantillas />;
}
