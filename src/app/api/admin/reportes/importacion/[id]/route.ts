import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { detalleLote } from '@/server/services/importacion/lotes';

/** Lote con su resumen por entidad (vista resumen_importacion_historica). */
export const GET = ruta({ permiso: 'datos.conciliar_historico', parametros: parametrosId }, async ({ parametros }) => detalleLote(parametros.id));
