import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { archivoDeFormulario } from '@/server/almacenamiento';
import * as servicio from '@/server/services/evaluacion/reglas';

/** Adjunta la evidencia (PDF de la norma o acta) a una regla en borrador. Cuerpo: FormData con `archivo`. */
export const POST = ruta({ permiso: 'academico.configurar_cierre_anual', parametros: parametrosId }, async ({ req, actor, parametros }) =>
  servicio.adjuntarEvidencia(actor, parametros.id, await archivoDeFormulario(await req.formData())),
);
