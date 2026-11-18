import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaConciliacion } from '@/esquemas/importacion/lotes';
import { conciliarFila } from '@/server/services/importacion/lotes';

/** Concilia una fila (crear/vincular/archivar/excluir con motivo) mediante conciliar_fila_historica. */
export const POST = ruta(
  { permiso: 'datos.conciliar_historico', parametros: parametrosId, cuerpo: esquemaConciliacion },
  async ({ actor, parametros, cuerpo }) => conciliarFila(actor, parametros.id, cuerpo),
);
