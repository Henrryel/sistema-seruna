import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAsignarSeccion } from '@/esquemas/academico/planes';
import * as servicio from '@/server/services/academico/planes';

/** Aplica el plan publicado a una sección (con vigencia) y crea sus cursos. */
export const POST = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaAsignarSeccion }, async ({ actor, parametros, cuerpo }) =>
  servicio.asignarSeccion(actor, parametros.id, cuerpo),
);
