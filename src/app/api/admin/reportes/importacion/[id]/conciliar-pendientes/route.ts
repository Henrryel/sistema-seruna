import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaConciliacionMasiva } from '@/esquemas/importacion/lotes';
import { conciliarPendientes } from '@/server/services/importacion/lotes';

/** Archiva o excluye todas las filas pendientes de una entidad (cada una pasa por la función de la base). */
export const POST = ruta(
  { permiso: 'datos.conciliar_historico', parametros: parametrosId, cuerpo: esquemaConciliacionMasiva },
  async ({ actor, parametros, cuerpo }) => conciliarPendientes(actor, parametros.id, cuerpo),
);
