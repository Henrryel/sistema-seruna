import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { exigirPermisoPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { parametrosId } from '@/esquemas/comunes';
import { ClienteDetalleMatricula } from './cliente';

export const metadata: Metadata = { title: 'Matrícula' };

export default async function PaginaMatricula({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina('matriculas.gestionar');
  const p = parametrosId.safeParse(await params);
  if (!p.success) notFound();
  return <ClienteDetalleMatricula id={p.data.id} puedeExpediente={tienePermiso(actor, 'expediente.gestionar')} />;
}
