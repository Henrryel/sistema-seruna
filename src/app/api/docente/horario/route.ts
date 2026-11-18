import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { fechaOpcional } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/portales';

/** Horario semanal del docente (solo sus bloques). */
export const GET = ruta({ portal: 'docente', consulta: z.object({ fecha: fechaOpcional }) }, async ({ actor, consulta }) =>
  servicio.horarioDocente(actor, consulta.fecha),
);
