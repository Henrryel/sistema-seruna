import { ruta } from '@/server/http/ruta';
import { consultaSesiones } from '@/esquemas/planilla/horas';
import * as servicio from '@/server/services/planilla/horas';

/** Sesiones de clase REALIZADAS por el docente del contrato en la fecha (vínculo opcional de las horas). */
export const GET = ruta({ permiso: 'planilla.horas', consulta: consultaSesiones }, async ({ consulta }) => ({
  opciones: await servicio.sesionesRealizadas(consulta.contratoId, consulta.fecha),
}));
