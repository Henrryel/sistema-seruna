import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaNuevaVersion } from '@/esquemas/evaluacion/cierre-anual';
import * as servicio from '@/server/services/evaluacion/cierre-anual';

/** Nueva versión de rectificación o de recuperación a partir del último cierre aprobado. */
export const POST = ruta({ permiso: 'academico.cerrar_anio', parametros: parametrosId, cuerpo: esquemaNuevaVersion }, async ({ actor, parametros, cuerpo }) =>
  servicio.nuevaVersion(actor, parametros.id, cuerpo),
);
