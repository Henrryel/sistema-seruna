import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/planilla/liquidaciones';

/** Incluye todas las horas aprobadas del mes aún no liquidadas. */
export const POST = ruta(
  { permiso: 'planilla.liquidar', parametros: parametrosId },
  async ({ actor, parametros }) => servicio.incluirHoras(actor, parametros.id),
);
