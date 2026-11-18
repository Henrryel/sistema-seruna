import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaPlantilla } from '@/esquemas/reportes/plantillas';
import { archivoOpcional, camposTexto, leerFormulario, validarDatos } from '@/server/services/reportes/entrada';
import * as servicio from '@/server/services/reportes/plantillas';

export const GET = ruta({ permiso: 'reportes.configurar', parametros: parametrosId }, async ({ parametros }) => servicio.obtenerPlantilla(parametros.id));

/** Edita un borrador (multipart; `archivo` opcional reemplaza el adjunto). La base protege las publicadas. */
export const PUT = ruta({ permiso: 'reportes.configurar', parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const form = await leerFormulario(req);
  const datos = validarDatos(esquemaPlantilla, camposTexto(form));
  return servicio.actualizarPlantilla(actor, parametros.id, datos, await archivoOpcional(form));
});
