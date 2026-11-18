import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { PERMISOS_VER_LIQUIDACIONES } from '@/esquemas/planilla/permisos';
import * as servicio from '@/server/services/planilla/liquidaciones';

export const GET = ruta(
  { permiso: PERMISOS_VER_LIQUIDACIONES, parametros: parametrosId },
  async ({ parametros }) => servicio.obtenerDetalle(parametros.id),
);

/** Elimina un BORRADOR (la base protege las aprobadas). */
export const DELETE = ruta(
  { permiso: 'planilla.liquidar', parametros: parametrosId },
  async ({ actor, parametros }) => servicio.eliminarBorrador(actor, parametros.id),
);
