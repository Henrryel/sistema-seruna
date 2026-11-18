import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaComprobante } from '@/esquemas/cobros/pagos';
import * as servicio from '@/server/services/cobros/pagos';
import { leerFormulario } from '@/app/api/admin/cobros/formulario';

export const runtime = 'nodejs';

/** Comprobante electrónico externo (SUNAT) asociado al pago (multipart: campos + `archivo` opcional). */
export const POST = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const { datos, adjunto } = await leerFormulario(req, esquemaComprobante);
  return servicio.registrarComprobante(actor, parametros.id, datos, adjunto);
});
