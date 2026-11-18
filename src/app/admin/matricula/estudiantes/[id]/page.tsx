import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { parametrosId } from '@/esquemas/comunes';
import { notFound } from 'next/navigation';
import { ClienteFichaEstudiante } from './cliente';

export const metadata: Metadata = { title: 'Ficha del estudiante' };

export default async function PaginaFichaEstudiante({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina('matriculas.gestionar');
  const p = parametrosId.safeParse(await params);
  if (!p.success) notFound();
  return (
    <ClienteFichaEstudiante
      id={p.data.id}
      puedeExpediente={tienePermiso(actor, 'expediente.gestionar')}
      puedeUsuarios={tienePermiso(actor, 'usuarios.gestionar')}
    />
  );
}
