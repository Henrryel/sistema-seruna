import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCapacidad } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaCapacidad }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarCapacidad(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarCapacidad(actor, parametros.id),
);
