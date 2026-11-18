import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/pagos';

export const GET = ruta({ permiso: ['tesoreria.cobrar', 'tesoreria.revertir'], parametros: parametrosId }, async ({ parametros }) =>
  servicio.obtenerPago(parametros.id),
);
