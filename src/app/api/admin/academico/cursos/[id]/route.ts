import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEstadoCurso } from '@/esquemas/academico/asignaciones';
import * as servicio from '@/server/services/academico/asignaciones';

export const PATCH = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaEstadoCurso }, async ({ actor, parametros, cuerpo }) =>
  servicio.cambiarEstadoCurso(actor, parametros.id, cuerpo.activo),
);
