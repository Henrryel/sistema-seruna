import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaRegla } from '@/esquemas/evaluacion/reglas';
import * as servicio from '@/server/services/evaluacion/reglas';

const PERMISO = 'academico.configurar_cierre_anual';

export const GET = ruta({ permiso: PERMISO, parametros: parametrosId }, async ({ parametros }) => servicio.obtenerRegla(parametros.id));

/** Solo borradores: la base rechaza cambios a una regla aprobada. */
export const PUT = ruta(
  { permiso: PERMISO, parametros: parametrosId, cuerpo: esquemaRegla.pick({ referenciaNormativa: true, criterios: true }) },
  async ({ actor, parametros, cuerpo }) => servicio.actualizarRegla(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: PERMISO, parametros: parametrosId }, async ({ actor, parametros }) => servicio.eliminarRegla(actor, parametros.id));
