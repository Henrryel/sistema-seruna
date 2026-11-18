import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaBimestre } from '@/esquemas/academico/anios';
import * as servicio from '@/server/services/academico/anios';

export const PUT = ruta(
  { permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaBimestre },
  async ({ actor, parametros, cuerpo }) => servicio.actualizarBimestre(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarBimestre(actor, parametros.id),
);
