import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaRetiro } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';
import { leerFormulario } from '@/app/api/admin/matricula/_lib/formulario';

/** Retiro o traslado (multipart: campos + `archivo` de evidencia opcional). */
export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const { datos, archivo } = await leerFormulario(req, esquemaRetiro, { archivo: 'opcional' });
  return servicio.retirarMatricula(actor, parametros.id, datos, archivo);
});
