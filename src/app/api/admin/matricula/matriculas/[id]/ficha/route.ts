import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { fichaMatriculaPdf } from '@/server/services/matricula/ficha';

export const runtime = 'nodejs';

/** Ficha de matrícula en PDF (descarga auditada). */
export const GET = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ actor, parametros }) => {
  const { buffer, nombre } = await fichaMatriculaPdf(actor, parametros.id);
  return descargar(buffer, nombre, 'application/pdf');
});
