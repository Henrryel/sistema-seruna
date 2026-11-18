import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/recuperacion';

export const POST = ruta({ permiso: 'academico.recuperacion', parametros: parametrosId }, async ({ actor, parametros }) => servicio.aprobarEvaluacion(actor, parametros.id));
