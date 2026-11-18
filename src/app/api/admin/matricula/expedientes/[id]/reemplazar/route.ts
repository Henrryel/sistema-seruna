import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/matricula/expedientes';
import { leerFormulario } from '@/app/api/admin/matricula/_lib/formulario';

/** Reemplaza el archivo (multipart con `archivo`): el actual queda "reemplazado". */
export const POST = ruta({ permiso: 'expediente.gestionar', parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const { archivo } = await leerFormulario(req, z.object({}), { archivo: 'requerido' });
  return servicio.reemplazarDocumento(actor, parametros.id, archivo);
});
