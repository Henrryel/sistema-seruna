import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { PERMISOS_COMUNICACIONES } from '@/esquemas/reportes/documentos';
import { evidenciaComunicacion } from '@/server/services/reportes/comunicaciones';

export const GET = ruta({ permiso: PERMISOS_COMUNICACIONES, parametros: parametrosId }, async ({ actor, parametros }) => {
  const a = await evidenciaComunicacion(actor, parametros.id);
  return descargar(a.contenido, a.nombre_original, a.tipo_mime);
});
