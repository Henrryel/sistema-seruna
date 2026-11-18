import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { fecha } from '@/esquemas/comunes';
import * as servicio from '@/server/services/asistencia/registro';

/** Secciones con asignación vigente del docente en la fecha. */
export const GET = ruta({ portal: 'docente', permiso: 'asistencia.registrar', consulta: z.object({ fecha }) }, async ({ actor, consulta }) => ({
  secciones: await servicio.seccionesDelDocente(actor, consulta.fecha),
}));
