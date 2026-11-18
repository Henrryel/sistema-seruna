import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaRevision } from '@/esquemas/matricula/expedientes';
import * as servicio from '@/server/services/matricula/expedientes';

/** Revisión: validar u observar el documento. */
export const PUT = ruta({ permiso: 'expediente.gestionar', parametros: parametrosId, cuerpo: esquemaRevision }, async ({ actor, parametros, cuerpo }) =>
  servicio.revisarDocumento(actor, parametros.id, cuerpo),
);
