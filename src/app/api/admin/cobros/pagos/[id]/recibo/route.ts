import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/pagos';

export const runtime = 'nodejs';

/** Recibo de caja en PDF. */
export const GET = ruta({ permiso: ['tesoreria.cobrar', 'tesoreria.revertir'], parametros: parametrosId }, async ({ parametros }) => {
  const r = await servicio.reciboPdf(parametros.id);
  return descargar(r.contenido, r.nombre, 'application/pdf');
});
