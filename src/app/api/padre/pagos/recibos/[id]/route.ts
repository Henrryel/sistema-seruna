import { z } from 'zod';
import { descargar, ruta } from '@/server/http/ruta';
import { id, parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/portal';

export const runtime = 'nodejs';

const consulta = z.object({ estudianteId: id });

/** Recibo en PDF del hijo (vínculo vigente + acceso económico + recibo del alumno). */
export const GET = ruta({ portal: 'padre', parametros: parametrosId, consulta }, async ({ actor, parametros, consulta }) => {
  const r = await servicio.reciboPadre(actor, consulta.estudianteId, parametros.id);
  return descargar(r.contenido, r.nombre, 'application/pdf');
});
