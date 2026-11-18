import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCopiarMapeos } from '@/esquemas/evaluacion/siagie';
import * as servicio from '@/server/services/evaluacion/siagie';

export const POST = ruta({ permiso: 'academico.exportar_siagie', parametros: parametrosId, cuerpo: esquemaCopiarMapeos }, async ({ actor, parametros, cuerpo }) =>
  servicio.copiarMapeos(actor, parametros.id, cuerpo.desdePlantillaId),
);
