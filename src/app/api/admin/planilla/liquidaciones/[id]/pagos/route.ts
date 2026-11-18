import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaPago } from '@/esquemas/planilla/liquidaciones';
import * as servicio from '@/server/services/planilla/liquidaciones';
import { leerCuerpoConArchivo } from '../../../_comun/formulario';

/** Pago idempotente (UUID del cliente). JSON o multipart con evidencia opcional. */
export const POST = ruta(
  { permiso: 'planilla.pagar', parametros: parametrosId },
  async ({ req, actor, parametros }) => {
    const { datos, archivo } = await leerCuerpoConArchivo(req, esquemaPago);
    return servicio.registrarPago(actor, parametros.id, datos, archivo);
  },
);
