import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaRequisito } from '@/esquemas/matricula/reglas';
import * as servicio from '@/server/services/matricula/reglas';

export const GET = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ parametros }) => ({
  requisitos: await servicio.listarRequisitos(parametros.id),
}));

/** Agrega o actualiza el requisito (tipo de documento) de la regla. */
export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaRequisito }, async ({ actor, parametros, cuerpo }) =>
  servicio.guardarRequisito(actor, parametros.id, cuerpo),
);
