import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/planilla/liquidaciones';

/** Vista previa del descuento por tardanzas (asistencia docente del período de la liquidación). */
export const GET = ruta({ permiso: 'planilla.liquidar', parametros: parametrosId }, async ({ parametros }) =>
  servicio.vistaPreviaTardanzas(parametros.id),
);

/** Registra el descuento como línea 'descuento' "Tardanzas (N min)". */
export const POST = ruta(
  { permiso: 'planilla.liquidar', parametros: parametrosId },
  async ({ actor, parametros }) => servicio.registrarTardanzas(actor, parametros.id),
);
