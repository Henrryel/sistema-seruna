import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaTramo } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

export const PUT = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaTramo }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarTramo(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarTramo(actor, parametros.id),
);
