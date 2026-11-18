import { ruta } from '@/server/http/ruta';
import { consultaSesionesSeccion } from '@/esquemas/asistencia/registro';
import * as servicio from '@/server/services/asistencia/registro';

/** Sesiones de clase PROPIAS del docente en la fecha. */
export const GET = ruta({ portal: 'docente', permiso: 'asistencia.registrar', consulta: consultaSesionesSeccion }, async ({ actor, consulta }) => ({
  sesiones: await servicio.listarSesiones(actor, { fecha: consulta.fecha, seccionId: consulta.seccionId }, 'docente'),
}));
