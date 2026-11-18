import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaSerie } from '@/esquemas/cobros/caja';
import * as servicio from '@/server/services/cobros/caja';

export const PUT = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaSerie }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarSerie(actor, parametros.id, cuerpo),
);
