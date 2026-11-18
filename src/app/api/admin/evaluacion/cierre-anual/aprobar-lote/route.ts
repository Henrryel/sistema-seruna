import { ruta } from '@/server/http/ruta';
import { esquemaAprobarLote } from '@/esquemas/evaluacion/cierre-anual';
import * as servicio from '@/server/services/evaluacion/cierre-anual';

/** Aprueba varios borradores con la situación sugerida por la regla vigente. */
export const POST = ruta({ permiso: 'academico.cerrar_anio', cuerpo: esquemaAprobarLote }, async ({ actor, cuerpo }) => ({
  resultados: await servicio.aprobarLote(actor, cuerpo),
}));
