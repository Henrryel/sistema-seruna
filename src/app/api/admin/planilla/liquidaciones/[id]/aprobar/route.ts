import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/planilla/liquidaciones';

export const POST = ruta(
  { permiso: 'planilla.liquidar', parametros: parametrosId },
  async ({ actor, parametros }) => servicio.aprobar(actor, parametros.id),
);
