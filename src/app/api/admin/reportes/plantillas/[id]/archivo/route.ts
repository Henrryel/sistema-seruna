import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/reportes/plantillas';

export const GET = ruta({ permiso: 'reportes.configurar', parametros: parametrosId }, async ({ parametros }) => {
  const a = await servicio.archivoPlantilla(parametros.id);
  return descargar(a.contenido, a.nombre_original, a.tipo_mime);
});
