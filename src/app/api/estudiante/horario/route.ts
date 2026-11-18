import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { fechaOpcional } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/portales';

/** Horario de la sección de la matrícula vigente del propio estudiante. */
export const GET = ruta({ portal: 'estudiante', consulta: z.object({ fecha: fechaOpcional }) }, async ({ actor, consulta }) =>
  servicio.horarioEstudiante(actor, consulta.fecha),
);
