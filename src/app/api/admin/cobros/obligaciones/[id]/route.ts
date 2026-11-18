import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEditarObligacion } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

export const PUT = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaEditarObligacion }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarObligacion(actor, parametros.id, cuerpo),
);
