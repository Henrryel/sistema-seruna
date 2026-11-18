import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaReversion } from '@/esquemas/planilla/liquidaciones';
import * as servicio from '@/server/services/planilla/liquidaciones';
import { leerCuerpoConArchivo } from '../../../_comun/formulario';

/** Revierte un pago con motivo (y evidencia opcional). JSON o multipart. */
export const POST = ruta(
  { permiso: 'planilla.revertir_pago', parametros: parametrosId },
  async ({ req, actor, parametros }) => {
    const { datos, archivo } = await leerCuerpoConArchivo(req, esquemaReversion);
    return servicio.revertirPago(actor, parametros.id, datos, archivo);
  },
);
