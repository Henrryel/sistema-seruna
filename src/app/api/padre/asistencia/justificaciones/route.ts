import { ruta } from '@/server/http/ruta';
import { leerSolicitudJustificacion } from '@/server/asistencia/http';
import * as servicio from '@/server/services/asistencia/justificaciones';

/**
 * El apoderado justifica la asistencia de un hijo: el servicio deduce el estudiante del registro y exige
 * vínculo vigente con acceso académico.
 */
export const POST = ruta({ portal: 'padre', permiso: 'asistencia.justificar' }, async ({ actor, req }) => {
  const { datos, evidencia } = await leerSolicitudJustificacion(req);
  return servicio.solicitarParaAlumno(actor, datos, 'padre', evidencia);
});
