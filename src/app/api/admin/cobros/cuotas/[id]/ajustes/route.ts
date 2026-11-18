import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAjuste } from '@/esquemas/cobros/cuotas';
import * as servicio from '@/server/services/cobros/cuotas';

export const GET = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ parametros }) => ({
  ajustes: await servicio.listarAjustes(parametros.id),
}));

export const POST = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId, cuerpo: esquemaAjuste }, async ({ actor, parametros, cuerpo }) =>
  servicio.registrarAjuste(actor, parametros.id, cuerpo),
);
