import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { fechaOpcional, id } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/portales';

/** Horario de un hijo: valida el vínculo vigente con estudiante_apoderado (acceso básico). */
export const GET = ruta({ portal: 'padre', consulta: z.object({ estudianteId: id, fecha: fechaOpcional }) }, async ({ actor, consulta }) =>
  servicio.horarioHijo(actor, consulta.estudianteId, consulta.fecha),
);
