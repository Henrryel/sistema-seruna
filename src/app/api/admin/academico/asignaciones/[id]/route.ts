import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaActualizarAsignacion } from '@/esquemas/academico/asignaciones';
import * as servicio from '@/server/services/academico/asignaciones';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaActualizarAsignacion }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarAsignacion(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarAsignacion(actor, parametros.id),
);
