import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCompetencia } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaCompetencia }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarCompetencia(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarCompetencia(actor, parametros.id),
);
