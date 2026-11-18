import { ruta } from '@/server/http/ruta';
import { parametrosDetalle } from '@/esquemas/planilla/liquidaciones';
import * as servicio from '@/server/services/planilla/liquidaciones';

/** Quita una línea del borrador (la base rechaza cambios en liquidaciones aprobadas). */
export const DELETE = ruta(
  { permiso: 'planilla.liquidar', parametros: parametrosDetalle },
  async ({ actor, parametros }) => servicio.eliminarLinea(actor, parametros.id, parametros.detalleId),
);
