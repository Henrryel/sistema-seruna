import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCambioSeccion } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';

export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaCambioSeccion }, async ({ actor, parametros, cuerpo }) =>
  servicio.cambiarSeccion(actor, parametros.id, cuerpo),
);
