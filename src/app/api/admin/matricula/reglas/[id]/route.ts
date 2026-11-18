import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaRegla } from '@/esquemas/matricula/reglas';
import * as servicio from '@/server/services/matricula/reglas';

export const GET = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ parametros }) => ({
  regla: await servicio.obtenerRegla(parametros.id),
  requisitos: await servicio.listarRequisitos(parametros.id),
}));

/** Solo reglas en borrador (las publicadas se cambian con una nueva versión). */
export const PUT = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaRegla }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarRegla(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarRegla(actor, parametros.id),
);
