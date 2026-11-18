import { ruta } from '@/server/http/ruta';
import { esquemaPeriodo } from '@/esquemas/planilla/liquidaciones';
import { PERMISOS_VER_LIQUIDACIONES } from '@/esquemas/planilla/permisos';
import * as servicio from '@/server/services/planilla/liquidaciones';

export const GET = ruta({ permiso: [...PERMISOS_VER_LIQUIDACIONES, 'planilla.aprobar_horas'] }, async () => ({
  periodos: await servicio.listarPeriodos(),
}));

/** Abre el mes de planilla (`mes` = 'AAAA-MM'); la base exige que nazca abierto y sea único. */
export const POST = ruta(
  { permiso: 'planilla.liquidar', cuerpo: esquemaPeriodo },
  async ({ actor, cuerpo }) => servicio.abrirPeriodo(actor, cuerpo),
);
