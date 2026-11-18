import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/matricula/documentos';

/** Descarga de archivos del módulo (autorizada por el registro que los referencia, auditada). */
export const GET = ruta({ permiso: ['matriculas.gestionar', 'expediente.gestionar'], parametros: parametrosId }, async ({ actor, parametros }) => {
  const a = await servicio.descargarArchivo(actor, parametros.id);
  return descargar(a.contenido, a.nombre_original, a.tipo_mime);
});
