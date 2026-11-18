import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { ForbiddenError } from '@/server/errores';
import { CATALOGOS, TIPOS_CATALOGO, type TipoCatalogo } from '@/server/repositories/catalogos';

const parametros = z.object({ tipo: z.enum(TIPOS_CATALOGO as [TipoCatalogo, ...TipoCatalogo[]]) });
const consulta = z.object({
  anioId: z.string().regex(/^\d+$/).optional(),
  gradoId: z.string().regex(/^\d+$/).optional(),
  areaId: z.string().regex(/^\d+$/).optional(),
  alcance: z.enum(['alumno', 'docente']).optional(),
});

/** Opciones para selects. Datos estructurales: portal admin o docente; `docentes` solo admin. */
export const GET = ruta({ parametros, consulta }, async ({ actor, parametros, consulta }) => {
  const admin = actor.portales.includes('admin');
  if (!admin && !(actor.portales.includes('docente') && parametros.tipo !== 'docentes')) throw new ForbiddenError();
  return { opciones: await CATALOGOS[parametros.tipo](consulta) };
});
