import { ruta } from '@/server/http/ruta';
import { leerSolicitudJustificacion } from '@/server/asistencia/http';
import * as servicio from '@/server/services/asistencia/justificaciones';

/** El alumno justifica SU asistencia (multipart: asistenciaId, motivo, archivo opcional). */
export const POST = ruta({ portal: 'estudiante', permiso: 'asistencia.justificar' }, async ({ actor, req }) => {
  const { datos, evidencia } = await leerSolicitudJustificacion(req);
  return servicio.solicitarParaAlumno(actor, datos, 'estudiante', evidencia);
});
