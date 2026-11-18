import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAceptacion } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';
import { leerFormulario } from '@/app/api/admin/matricula/_lib/formulario';

/** Aceptación de un documento institucional (multipart con `archivo` de evidencia opcional). */
export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ req, actor, parametros }) => {
  const { datos, archivo } = await leerFormulario(req, esquemaAceptacion, { archivo: 'opcional' });
  return servicio.registrarAceptacion(actor, parametros.id, datos, archivo);
});
