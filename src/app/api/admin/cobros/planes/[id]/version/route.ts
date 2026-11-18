import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/planes';

/** Crea una nueva versión (borrador) copiando el plan y sus tramos. */
export const POST = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.nuevaVersion(actor, parametros.id),
);
