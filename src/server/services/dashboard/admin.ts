import 'server-only';
import { transaccion } from '@/server/db';
import { ForbiddenError } from '@/server/errores';
import { tienePermiso, type Permiso } from '@/server/autorizacion/permisos';
import type { Actor } from '@/server/auth/actor';
import * as repo from '@/server/repositories/dashboard/dashboard';
import { BLOQUES_DASHBOARD, type BloqueDashboard, type ConsultaDashboard, type RespuestaDashboard } from '@/esquemas/dashboard/dashboard';

// Panel institucional. Los indicadores los calcula y valida `indicadores_dashboard` (año, rango, bimestre);
// aquí solo se decide qué bloques ve el actor según sus permisos y se agregan desgloses.

export const PERMISOS_BLOQUE: Record<BloqueDashboard, readonly Permiso[]> = {
  matricula: ['reportes.dashboard', 'reportes.matriculas'],
  asistencia: ['reportes.dashboard', 'reportes.asistencia'],
  pagos: ['reportes.dashboard', 'reportes.tesoreria'],
  notas: ['reportes.dashboard', 'reportes.academico'],
  planilla: ['reportes.dashboard', 'planilla.liquidar', 'planilla.pagar'],
};

/** Permisos que habilitan al menos un bloque del panel. */
export const PERMISOS_DASHBOARD: readonly Permiso[] = [...new Set(Object.values(PERMISOS_BLOQUE).flat())];

export function bloquesPermitidos(actor: Pick<Actor, 'permisos'>): BloqueDashboard[] {
  return BLOQUES_DASHBOARD.filter((b) => tienePermiso(actor, PERMISOS_BLOQUE[b]));
}

export async function consultarDashboard(actor: Actor, c: ConsultaDashboard): Promise<RespuestaDashboard> {
  const bloques = bloquesPermitidos(actor);
  if (bloques.length === 0) throw new ForbiddenError('No tiene permiso para consultar indicadores institucionales');
  // Una sola transacción: todas las cifras salen de la misma foto de los datos.
  return transaccion(() => armarDashboard(bloques, c));
}

async function armarDashboard(bloques: BloqueDashboard[], c: ConsultaDashboard): Promise<RespuestaDashboard> {
  // La función de la base valida el año, el rango y que el bimestre pertenezca al año.
  const ind = await repo.indicadores(c.anioId, c.desde, c.hasta, c.bimestreId);
  const r: RespuestaDashboard = { bloques };
  if (bloques.includes('matricula')) r.matricula = ind.matricula;
  if (bloques.includes('asistencia')) r.asistencia = ind.asistencia;
  if (bloques.includes('pagos')) r.pagos = { ...ind.pagos, recaudacion: await repo.recaudacionPorDia(c.anioId, c.desde, c.hasta) };
  if (bloques.includes('notas')) {
    r.notas = {
      avance: ind.notas,
      distribucion: c.bimestreId ? await repo.distribucionNiveles(c.anioId, c.bimestreId, c.hasta) : [],
    };
  }
  if (bloques.includes('planilla')) r.planilla = await repo.resumenPlanilla(c.desde, c.hasta);
  return r;
}
