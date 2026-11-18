import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/matricula/reglas';

/** Crea una nueva versión (borrador) copiando datos y requisitos. */
export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.nuevaVersion(actor, parametros.id),
);
