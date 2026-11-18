import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEditarPlan } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

export const GET = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ parametros }) => servicio.obtenerPlan(parametros.id));

export const PUT = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaEditarPlan }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarPlan(actor, parametros.id, cuerpo),
);
