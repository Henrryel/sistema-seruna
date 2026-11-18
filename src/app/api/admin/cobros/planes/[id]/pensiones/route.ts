import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaGenerarPensiones } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

/** Genera (reemplaza) las pensiones mensuales del borrador. */
export const POST = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaGenerarPensiones }, async ({ actor, parametros, cuerpo }) =>
  servicio.generarPensiones(actor, parametros.id, cuerpo),
);
