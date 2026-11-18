import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/cierre-anual';

/** Vuelve a tomar los resultados desde los últimos logros publicados y recalcula la situación sugerida. */
export const POST = ruta({ permiso: 'academico.cerrar_anio', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.actualizarBorrador(actor, parametros.id),
);
