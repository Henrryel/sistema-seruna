import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { consultaSecciones } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';

/** Secciones del año y grado de la matrícula con su ocupación en la fecha (informativo). */
export const GET = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, consulta: consultaSecciones }, async ({ parametros, consulta }) =>
  servicio.seccionesDeMatricula(parametros.id, consulta.fecha),
);
