import { ruta } from '@/server/http/ruta';
import { esquemaAccionLote } from '@/esquemas/evaluacion/cierres';
import * as servicio from '@/server/services/evaluacion/cierres';

export const POST = ruta({ permiso: 'academico.publicar', cuerpo: esquemaAccionLote }, async ({ actor, cuerpo }) => ({
  resultados: await servicio.ejecutarLote(actor, cuerpo),
}));
