import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEditarRecuperacion } from '@/esquemas/evaluacion/recuperacion';
import * as servicio from '@/server/services/evaluacion/recuperacion';

/** Edita un borrador (la base impide cambiar una evaluación aprobada). */
export const PUT = ruta({ permiso: 'academico.recuperacion', parametros: parametrosId, cuerpo: esquemaEditarRecuperacion }, async ({ actor, parametros, cuerpo }) =>
  servicio.editarEvaluacion(actor, parametros.id, cuerpo),
);
