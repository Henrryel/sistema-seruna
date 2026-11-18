import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/planilla/portal-docente';

export const runtime = 'nodejs';

/** Boleta PDF de una liquidación APROBADA del propio docente. */
export const GET = ruta({ portal: 'docente', parametros: parametrosId }, async ({ actor, parametros }) => {
  const b = await servicio.boleta(actor, parametros.id);
  return descargar(b.contenido, b.nombre, 'application/pdf');
});
