import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaVigencia } from '@/esquemas/academico/planes';
import * as servicio from '@/server/services/academico/planes';

/** Ajusta la vigencia del plan aplicado a una sección (la base valida año y solapes). */
export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaVigencia }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarVigenciaSeccionPlan(actor, parametros.id, cuerpo),
);
