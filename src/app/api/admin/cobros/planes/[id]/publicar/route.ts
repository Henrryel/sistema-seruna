import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/planes';

export const POST = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.publicarPlan(actor, parametros.id),
);
