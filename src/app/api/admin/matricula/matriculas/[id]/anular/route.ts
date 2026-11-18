import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAnulacion } from '@/esquemas/matricula/matriculas';
import * as servicio from '@/server/services/matricula/matriculas';

export const POST = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaAnulacion }, async ({ actor, parametros, cuerpo }) =>
  servicio.anularMatricula(actor, parametros.id, cuerpo),
);
