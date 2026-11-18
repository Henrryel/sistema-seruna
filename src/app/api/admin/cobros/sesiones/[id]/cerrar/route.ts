import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCerrarSesion } from '@/esquemas/cobros/caja';
import * as servicio from '@/server/services/cobros/caja';

/** Cierre con arqueo (saldo contado). */
export const POST = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaCerrarSesion }, async ({ actor, parametros, cuerpo }) =>
  servicio.cerrarSesion(actor, parametros.id, cuerpo),
);
