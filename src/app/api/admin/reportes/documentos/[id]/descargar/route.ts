import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { PERMISOS_REPORTES } from '@/esquemas/reportes/documentos';
import { descargarDocumento } from '@/server/services/reportes/documentos';

/** Descarga autorizada (solicitante o permiso del tipo) y auditada. */
export const GET = ruta({ permiso: PERMISOS_REPORTES, parametros: parametrosId }, async ({ actor, parametros }) => {
  const a = await descargarDocumento(actor, parametros.id);
  return descargar(a.contenido, a.nombre_original, a.tipo_mime);
});
