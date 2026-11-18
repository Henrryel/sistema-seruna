import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAprobarCierre } from '@/esquemas/evaluacion/cierre-anual';
import * as servicio from '@/server/services/evaluacion/cierre-anual';

export const POST = ruta({ permiso: 'academico.cerrar_anio', parametros: parametrosId, cuerpo: esquemaAprobarCierre }, async ({ actor, parametros, cuerpo }) =>
  servicio.aprobarCierreAnual(actor, parametros.id, cuerpo),
);
