import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaResolverExportacion } from '@/esquemas/evaluacion/siagie';
import * as servicio from '@/server/services/evaluacion/siagie';

export const POST = ruta({ permiso: 'academico.exportar_siagie', parametros: parametrosId, cuerpo: esquemaResolverExportacion }, async ({ actor, parametros, cuerpo }) =>
  servicio.resolverExportacion(actor, parametros.id, cuerpo),
);
