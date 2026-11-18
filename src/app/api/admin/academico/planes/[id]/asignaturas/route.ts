import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaAsignaturaPlan } from '@/esquemas/academico/planes';
import * as servicio from '@/server/services/academico/planes';

export const POST = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaAsignaturaPlan }, async ({ actor, parametros, cuerpo }) =>
  servicio.agregarAsignatura(actor, parametros.id, cuerpo.asignaturaId),
);

/** DELETE ?asignaturaId=… */
export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId, consulta: esquemaAsignaturaPlan }, async ({ actor, parametros, consulta }) =>
  servicio.quitarAsignatura(actor, parametros.id, consulta.asignaturaId),
);
