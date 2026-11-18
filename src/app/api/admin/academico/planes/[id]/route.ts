import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/planes';

export const GET = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ parametros }) => servicio.obtenerPlan(parametros.id));

/** Solo planes en borrador. */
export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) => servicio.eliminarPlan(actor, parametros.id));
