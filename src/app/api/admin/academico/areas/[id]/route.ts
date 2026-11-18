import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaArea } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaArea }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarArea(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) => servicio.eliminarArea(actor, parametros.id));
