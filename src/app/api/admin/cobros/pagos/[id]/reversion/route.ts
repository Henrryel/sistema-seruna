import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaReversion } from '@/esquemas/cobros/pagos';
import * as servicio from '@/server/services/cobros/pagos';

/** Reversión total del pago (con motivo). */
export const POST = ruta({ permiso: 'tesoreria.revertir', parametros: parametrosId, cuerpo: esquemaReversion }, async ({ actor, parametros, cuerpo }) =>
  servicio.revertirPago(actor, parametros.id, cuerpo),
);
