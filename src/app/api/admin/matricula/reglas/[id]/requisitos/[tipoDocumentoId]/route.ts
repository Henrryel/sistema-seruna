import { ruta } from '@/server/http/ruta';
import { parametrosRequisito } from '@/esquemas/matricula/reglas';
import * as servicio from '@/server/services/matricula/reglas';

export const DELETE = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosRequisito }, async ({ actor, parametros }) =>
  servicio.eliminarRequisito(actor, parametros.id, parametros.tipoDocumentoId),
);
