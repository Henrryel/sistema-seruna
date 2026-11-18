import { ruta } from '@/server/http/ruta';
import { esquemaActualizarDia, parametrosDia } from '@/esquemas/academico/calendario';
import * as servicio from '@/server/services/academico/calendario';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosDia, cuerpo: esquemaActualizarDia }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarDia(actor, parametros.anioId, parametros.fecha, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosDia }, async ({ actor, parametros }) =>
  servicio.eliminarDia(actor, parametros.anioId, parametros.fecha),
);
