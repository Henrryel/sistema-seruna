import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaMapeo } from '@/esquemas/academico/planes';
import * as servicio from '@/server/services/academico/planes';

/** Reemplaza las competencias que califica una asignatura del plan. */
export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaMapeo }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarMapeo(actor, parametros.id, cuerpo),
);
