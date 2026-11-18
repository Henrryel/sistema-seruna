import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAnio } from '@/esquemas/academico/anios';
import * as servicio from '@/server/services/academico/anios';

export const GET = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ parametros }) =>
  servicio.obtenerAnio(parametros.id),
);

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaAnio }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarAnio(actor, parametros.id, cuerpo),
);
