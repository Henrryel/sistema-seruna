import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaTipoDocumento } from '@/esquemas/matricula/reglas';
import * as servicio from '@/server/services/matricula/reglas';

export const PUT = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaTipoDocumento }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarTipoDocumento(actor, parametros.id, cuerpo),
);

/** La base impide eliminarlo si ya se usa en requisitos o expedientes (FK). */
export const DELETE = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarTipoDocumento(actor, parametros.id),
);
