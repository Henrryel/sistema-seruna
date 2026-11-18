import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { avanzarLote } from '@/server/services/importacion/lotes';

/** carga → revisión (si coincide el manifiesto) → cerrado (sin pendientes): avanzar_lote_historico. */
export const POST = ruta({ permiso: 'datos.conciliar_historico', parametros: parametrosId }, async ({ actor, parametros }) =>
  avanzarLote(actor, parametros.id),
);
