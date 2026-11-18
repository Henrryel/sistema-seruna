import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaActualizarBloque } from '@/esquemas/academico/horarios';
import * as servicio from '@/server/services/academico/horarios';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaActualizarBloque }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarBloque(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) => servicio.eliminarBloque(actor, parametros.id));
