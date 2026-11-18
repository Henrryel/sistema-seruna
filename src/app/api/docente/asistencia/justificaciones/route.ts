import { ruta } from '@/server/http/ruta';
import { leerSolicitudJustificacion } from '@/server/asistencia/http';
import * as servicio from '@/server/services/asistencia/justificaciones';

/** Justificación de la asistencia PROPIA del docente (multipart: asistenciaId, motivo, archivo opcional). */
export const POST = ruta({ portal: 'docente', permiso: 'asistencia.justificar' }, async ({ actor, req }) => {
  const { datos, evidencia } = await leerSolicitudJustificacion(req);
  return servicio.solicitarParaDocente(actor, datos, evidencia);
});
