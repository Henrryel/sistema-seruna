import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { id } from '@/esquemas/comunes';
import * as servicio from '@/server/services/asistencia/configuracion';

/** Secciones (con turno) y docentes activos para la generación masiva de jornadas. */
export const GET = ruta({ permiso: 'asistencia.configurar', portal: 'admin', consulta: z.object({ anioId: id }) }, async ({ consulta }) =>
  servicio.opcionesGeneracion(consulta.anioId),
);
