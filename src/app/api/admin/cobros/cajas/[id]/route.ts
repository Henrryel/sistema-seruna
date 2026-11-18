import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCaja } from '@/esquemas/cobros/caja';
import * as servicio from '@/server/services/cobros/caja';

export const PUT = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaCaja }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarCaja(actor, parametros.id, cuerpo),
);
