import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAccionCierre } from '@/esquemas/evaluacion/cierres';
import * as servicio from '@/server/services/evaluacion/cierres';

export const GET = ruta({ permiso: 'academico.publicar', parametros: parametrosId }, async ({ parametros }) => servicio.detalleCierre(parametros.id));

/** Cerrar, publicar o reabrir (con motivo). La base valida cada transición. */
export const POST = ruta({ permiso: 'academico.publicar', parametros: parametrosId, cuerpo: esquemaAccionCierre }, async ({ actor, parametros, cuerpo }) =>
  servicio.ejecutarAccion(actor, parametros.id, cuerpo.accion, cuerpo.motivo),
);
