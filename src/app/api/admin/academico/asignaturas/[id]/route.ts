import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAsignatura } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaAsignatura }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarAsignatura(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarAsignatura(actor, parametros.id),
);
