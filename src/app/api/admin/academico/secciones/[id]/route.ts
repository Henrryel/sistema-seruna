import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaSeccion } from '@/esquemas/academico/secciones';
import * as servicio from '@/server/services/academico/secciones';

export const GET = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ parametros }) => servicio.obtenerSeccion(parametros.id));

export const PUT = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaSeccion }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarSeccion(actor, parametros.id, cuerpo),
);
