import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaConfirmacion } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';

export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaConfirmacion }, async ({ actor, parametros, cuerpo }) =>
  servicio.confirmarMatricula(actor, parametros.id, cuerpo),
);
