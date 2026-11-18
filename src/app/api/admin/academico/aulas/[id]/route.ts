import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAula } from '@/esquemas/academico/secciones';
import * as servicio from '@/server/services/academico/secciones';

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaAula }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarAula(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) => servicio.eliminarAula(actor, parametros.id));
