import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAccesos } from '@/esquemas/matricula/apoderados';
import * as servicio from '@/server/services/matricula/apoderados';

/** Otorga o retira acceso académico/económico (la base exige el vínculo verificado). */
export const PUT = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaAccesos }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarAccesos(actor, parametros.id, cuerpo),
);
