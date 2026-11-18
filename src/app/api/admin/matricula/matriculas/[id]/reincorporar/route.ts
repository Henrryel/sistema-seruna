import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaReincorporacion } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';

export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaReincorporacion }, async ({ actor, parametros, cuerpo }) =>
  servicio.reincorporarMatricula(actor, parametros.id, cuerpo),
);
