import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCapacidad } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const GET = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ parametros }) => servicio.listarCapacidades(parametros.id));

export const POST = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaCapacidad }, async ({ actor, parametros, cuerpo }) =>
  servicio.crearCapacidad(actor, parametros.id, cuerpo),
);
