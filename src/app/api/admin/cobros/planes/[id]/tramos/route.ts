import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaTramo } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

export const GET = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ parametros }) => ({
  tramos: await servicio.listarTramos(parametros.id),
}));

export const POST = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaTramo }, async ({ actor, parametros, cuerpo }) =>
  servicio.crearTramo(actor, parametros.id, cuerpo),
);
