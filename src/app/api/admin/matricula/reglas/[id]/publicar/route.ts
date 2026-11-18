import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/matricula/reglas';

export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.publicarRegla(actor, parametros.id),
);
