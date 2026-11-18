import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { ClienteCalificacionesAdmin } from './cliente';

export const metadata: Metadata = { title: 'Calificaciones' };

export default async function PaginaCalificacionesAdmin() {
  await exigirPermisoPagina(['academico.calificar', 'academico.publicar']);
  return <ClienteCalificacionesAdmin />;
}
