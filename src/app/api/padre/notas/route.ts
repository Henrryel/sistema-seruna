import { ruta } from '@/server/http/ruta';
import { consultaNotasPadre } from '@/esquemas/evaluacion/notas';
import * as servicio from '@/server/services/evaluacion/notas';

/** Logros publicados de un hijo con vínculo vigente y acceso académico. */
export const GET = ruta({ portal: 'padre', consulta: consultaNotasPadre }, async ({ actor, consulta }) =>
  servicio.notasHijo(actor, consulta.estudianteId, consulta.matriculaId),
);
