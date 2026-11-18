import { ruta } from '@/server/http/ruta';
import { consultaGrillaAdmin } from '@/esquemas/evaluacion/calificaciones';
import * as servicio from '@/server/services/evaluacion/calificaciones';

export const GET = ruta({ portal: 'admin', permiso: ['academico.calificar', 'academico.publicar'], consulta: consultaGrillaAdmin }, async ({ consulta }) => ({
  revisiones: await servicio.historialAdmin(consulta),
}));
