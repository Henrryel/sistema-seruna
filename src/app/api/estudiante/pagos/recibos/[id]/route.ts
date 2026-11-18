import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/portal';

export const runtime = 'nodejs';

/** Recibo en PDF, solo si el pago corresponde al alumno autenticado. */
export const GET = ruta({ portal: 'estudiante', parametros: parametrosId }, async ({ actor, parametros }) => {
  const r = await servicio.reciboEstudiante(actor, parametros.id);
  return descargar(r.contenido, r.nombre, 'application/pdf');
});
