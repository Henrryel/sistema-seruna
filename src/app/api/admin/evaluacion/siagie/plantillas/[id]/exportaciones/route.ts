import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/siagie';

/** Prepara una exportación con `preparar_exportacion_siagie` (estado "preparada"). */
export const POST = ruta({ permiso: 'academico.exportar_siagie', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.prepararExportacion(actor, parametros.id),
);
