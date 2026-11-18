import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/pagos';

export const runtime = 'nodejs';

/** Evidencia de devolución o comprobante adjunto (solo archivos vinculados a pagos). */
export const GET = ruta({ permiso: ['tesoreria.cobrar', 'tesoreria.revertir'], parametros: parametrosId }, async ({ parametros }) => {
  const a = await servicio.archivoDePago(parametros.id);
  return descargar(a.contenido, a.nombre_original, a.tipo_mime);
});
