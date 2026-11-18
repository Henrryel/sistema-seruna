import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaDevolucion } from '@/esquemas/cobros/pagos';
import * as servicio from '@/server/services/cobros/pagos';
import { leerFormulario } from '@/app/api/admin/cobros/formulario';

export const runtime = 'nodejs';

/** Devolución sobre una aplicación del pago (multipart: campos + `archivo` de evidencia opcional). */
export const POST = ruta({ permiso: 'tesoreria.revertir', parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const { datos, adjunto } = await leerFormulario(req, esquemaDevolucion);
  return servicio.registrarDevolucion(actor, parametros.id, datos, adjunto);
});
