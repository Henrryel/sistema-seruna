import { ruta } from '@/server/http/ruta';
import { consultaSesionesSeccion } from '@/esquemas/asistencia/registro';
import * as servicio from '@/server/services/asistencia/registro';

/** Sesiones de clase (no canceladas) de una sección en una fecha. */
export const GET = ruta({ permiso: 'asistencia.registrar', portal: 'admin', consulta: consultaSesionesSeccion }, async ({ actor, consulta }) => ({
  sesiones: await servicio.listarSesiones(actor, { fecha: consulta.fecha, seccionId: consulta.seccionId }, 'admin'),
}));
