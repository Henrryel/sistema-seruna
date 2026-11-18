import 'server-only';
import { NotFoundError } from '@/server/errores';
import { docenteDelActor } from '@/server/autorizacion/alcance';
import type { Paginacion } from '@/server/http/listado';
import * as repoContratos from '@/server/repositories/planilla/contratos';
import * as repoHoras from '@/server/repositories/planilla/horas';
import * as repoLiq from '@/server/repositories/planilla/liquidaciones';
import { generarBoletaPdf } from '@/server/pdf/planilla/boleta';
import type { Actor } from '@/server/auth/actor';
import type { EstadoHora } from '@/esquemas/planilla/horas';
import type { ResumenPlanillaDocente } from '@/esquemas/planilla/portal';

// Portal docente: ALCANCE PROPIO. El docente se obtiene SIEMPRE de la sesión (`docenteDelActor`),
// nunca de parámetros; solo ve sus contratos, sus horas y sus liquidaciones APROBADAS.

export async function resumen(actor: Actor): Promise<ResumenPlanillaDocente> {
  const { docenteId, codigo } = await docenteDelActor(actor);
  const [contratos, liquidaciones] = await Promise.all([
    repoContratos.listarContratos({ docenteId }, { limite: 50, desplazamiento: 0 }),
    repoLiq.listarLiquidaciones({ docenteId, estado: 'aprobada' }, { limite: 60, desplazamiento: 0 }),
  ]);
  return {
    docente: { codigo, nombres: actor.nombres, apellidos: actor.apellidos },
    // Sin datos internos de auditoría ni conteos administrativos.
    contratos: contratos.filas.map((c) => ({
      id: c.id,
      referencia: c.referencia,
      modalidad: c.modalidad,
      inicio: c.inicio,
      fin: c.fin,
      sueldo_mensual: c.sueldo_mensual,
      tarifa_hora: c.tarifa_hora,
      minutos_por_hora: c.minutos_por_hora,
    })),
    liquidaciones: liquidaciones.filas,
  };
}

export async function listarHoras(
  actor: Actor,
  filtros: { estado?: EstadoHora; desde?: string; hasta?: string; q?: string },
  p: Paginacion | null,
) {
  const { docenteId } = await docenteDelActor(actor);
  return repoHoras.listarHoras({ ...filtros, docenteId }, p);
}

/** Boleta PDF de una liquidación APROBADA del propio docente (otra cualquiera: "no existe"). */
export async function boleta(actor: Actor, liquidacionId: string) {
  const { docenteId } = await docenteDelActor(actor);
  const d = await repoLiq.detalleLiquidacion(liquidacionId);
  if (!d || d.docente_id !== docenteId || d.estado !== 'aprobada')
    throw new NotFoundError('La liquidación no existe');
  return {
    contenido: await generarBoletaPdf(d),
    nombre: `boleta-${d.mes.slice(0, 7)}-${d.codigo_docente}.pdf`,
  };
}
