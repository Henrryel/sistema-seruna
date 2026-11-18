import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/matricula/apoderados';
import { leerFormulario } from '../../../_lib/formulario';

/** Verifica el vínculo; multipart con `archivo` de evidencia opcional (p. ej. copia de DNI o partida). */
export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const { archivo } = await leerFormulario(req, z.object({}), { archivo: 'opcional' });
  return servicio.verificarVinculo(actor, parametros.id, archivo);
});
