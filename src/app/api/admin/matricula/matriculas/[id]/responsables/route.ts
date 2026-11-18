import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaResponsable } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';

/** Registra el responsable económico desde una fecha (cierra al anterior el día previo). */
export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaResponsable }, async ({ actor, parametros, cuerpo }) =>
  servicio.registrarResponsable(actor, parametros.id, cuerpo),
);
