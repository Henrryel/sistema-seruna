import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/reportes/plantillas';

/** Crea una nueva versión (borrador) copiando la plantilla indicada. */
export const POST = ruta({ permiso: 'reportes.configurar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.nuevaVersion(actor, parametros.id),
);
