import { ruta } from '@/server/http/ruta';
import { consultaGrillaDocente } from '@/esquemas/evaluacion/calificaciones';
import * as servicio from '@/server/services/evaluacion/calificaciones';

export const GET = ruta({ portal: 'docente', permiso: 'academico.calificar', consulta: consultaGrillaDocente }, async ({ actor, consulta }) => ({
  revisiones: await servicio.historialDocente(actor, consulta),
}));
