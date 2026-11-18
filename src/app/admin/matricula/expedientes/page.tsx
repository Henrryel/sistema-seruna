import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { id } from '@/esquemas/comunes';
import { obtenerEstudiante } from '@/server/services/matricula/estudiantes';
import { ClienteExpedientes } from './cliente';

export const metadata: Metadata = { title: 'Expedientes' };

export default async function PaginaExpedientes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPermisoPagina('expediente.gestionar');
  const sp = await searchParams;
  const estudianteId = id.safeParse(sp.estudianteId);
  const matriculaId = id.safeParse(sp.matriculaId);
  let estudiante: { id: string; etiqueta: string } | null = null;
  if (estudianteId.success) {
    const e = await obtenerEstudiante(estudianteId.data).catch(() => null);
    if (e) estudiante = { id: e.id, etiqueta: `${e.apellidos}, ${e.nombres} (${e.codigo})` };
  }
  return <ClienteExpedientes estudianteInicial={estudiante} matriculaInicial={matriculaId.success ? matriculaId.data : null} />;
}
