import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaResolverHora } from '@/esquemas/planilla/horas';
import * as servicio from '@/server/services/planilla/horas';

export const POST = ruta(
  { permiso: 'planilla.aprobar_horas', parametros: parametrosId, cuerpo: esquemaResolverHora },
  async ({ actor, parametros, cuerpo }) => servicio.resolverHora(actor, parametros.id, cuerpo),
);
