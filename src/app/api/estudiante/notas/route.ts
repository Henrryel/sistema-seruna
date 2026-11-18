import { ruta } from '@/server/http/ruta';
import { consultaNotasEstudiante } from '@/esquemas/evaluacion/notas';
import * as servicio from '@/server/services/evaluacion/notas';

/** Logros publicados del propio estudiante (alcance: solo su registro). */
export const GET = ruta({ portal: 'estudiante', consulta: consultaNotasEstudiante }, async ({ actor, consulta }) => servicio.notasEstudiante(actor, consulta.matriculaId));
