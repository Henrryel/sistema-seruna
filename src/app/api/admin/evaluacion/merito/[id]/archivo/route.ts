import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/merito';

export const GET = ruta({ permiso: 'academico.publicar_merito', parametros: parametrosId }, async ({ parametros }) => {
  const a = await servicio.archivoPublicacion(parametros.id);
  return descargar(a.contenido, a.nombre_original, a.tipo_mime);
});
