import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/siagie';

/** Escribe las notas preparadas sobre la plantilla oficial y marca la exportación como generada. */
export const POST = ruta({ permiso: 'academico.exportar_siagie', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.generarExcel(actor, parametros.id),
);
