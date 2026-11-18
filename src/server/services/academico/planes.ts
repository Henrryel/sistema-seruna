import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/academico/planes';
import { rango } from '@/server/repositories/academico/comunes';
import type { Actor } from '@/server/auth/actor';
import type { DatosAsignarSeccion, DatosMapeo, DatosPlan } from '@/esquemas/academico/planes';
import { conMensajes } from './restricciones';

// Planes de estudio versionados. Regla de la app: un plan publicado es inmutable (su contenido se cambia
// creando una nueva versión). La base valida al aplicarlo a una sección (publicado, vigencia en el año,
// sin solapes) y en los cursos/horarios que dependen de él.

export const listarPlanes = repo.listarPlanes;

const MENSAJE_PUBLICADO = 'El plan ya está publicado y su contenido no se puede modificar. Cree una nueva versión.';

async function exigirPlan(id: string) {
  const p = await repo.obtenerPlan(id);
  if (!p) throw new NotFoundError('El plan de estudios no existe');
  return p;
}

async function exigirBorrador(id: string) {
  const p = await exigirPlan(id);
  if (p.publicado_en) throw new ConflictError(MENSAJE_PUBLICADO);
  return p;
}

export async function obtenerPlan(id: string) {
  const p = await repo.detallePlan(id);
  if (!p) throw new NotFoundError('El plan de estudios no existe');
  return p;
}

const auditar = (actor: Actor, accion: string, entidad: string, registroId: string, motivo?: string) =>
  registrarBitacora({ actorId: actor.usuarioId, accion, entidad, registroId, motivo: motivo ?? null, resultado: 'ok' });

export async function crearPlan(actor: Actor, d: DatosPlan) {
  const origen = d.basadoEn ? await exigirPlan(d.basadoEn) : null;
  return transaccion(async () => {
    const version = d.version ?? (await repo.siguienteVersion(d.anioId, d.gradoId));
    const p = await conMensajes(() => repo.crearPlan({ anioId: d.anioId, gradoId: d.gradoId, version }));
    if (origen) await repo.copiarContenido(origen.id, p.id);
    await auditar(actor, 'crear', 'planes_estudio', p.id, origen ? `v${version} basada en plan ${origen.id}` : `v${version}`);
    return { id: p.id, version };
  });
}

export async function eliminarPlan(actor: Actor, id: string) {
  await exigirBorrador(id);
  return transaccion(async () => {
    const r = await conMensajes(() => repo.eliminarBorrador(id));
    if (!r) throw new ConflictError(MENSAJE_PUBLICADO);
    await auditar(actor, 'eliminar', 'planes_estudio', id);
    return r;
  });
}

export async function agregarAsignatura(actor: Actor, planId: string, asignaturaId: string) {
  await exigirBorrador(planId);
  return transaccion(async () => {
    await conMensajes(() => repo.agregarAsignatura(planId, asignaturaId));
    await auditar(actor, 'agregar_asignatura', 'plan_asignaturas', planId, `asignatura ${asignaturaId}`);
    return { ok: true };
  });
}

export async function quitarAsignatura(actor: Actor, planId: string, asignaturaId: string) {
  await exigirBorrador(planId);
  return transaccion(async () => {
    const r = await conMensajes(() => repo.quitarAsignatura(planId, asignaturaId));
    if (!r) throw new NotFoundError('La asignatura no está en el plan');
    await auditar(actor, 'quitar_asignatura', 'plan_asignaturas', planId, `asignatura ${asignaturaId}`);
    return { ok: true };
  });
}

export async function agregarCompetencia(actor: Actor, planId: string, competenciaId: string) {
  await exigirBorrador(planId);
  return transaccion(async () => {
    await conMensajes(() => repo.agregarCompetencia(planId, competenciaId));
    await auditar(actor, 'agregar_competencia', 'plan_competencias', planId, `competencia ${competenciaId}`);
    return { ok: true };
  });
}

export async function quitarCompetencia(actor: Actor, planId: string, competenciaId: string) {
  await exigirBorrador(planId);
  return transaccion(async () => {
    const r = await conMensajes(() => repo.quitarCompetencia(planId, competenciaId));
    if (!r) throw new NotFoundError('La competencia no está en el plan');
    await auditar(actor, 'quitar_competencia', 'plan_competencias', planId, `competencia ${competenciaId}`);
    return { ok: true };
  });
}

/** Define qué competencias del plan califica una asignatura del plan (las FK exigen que ambas estén en él). */
export async function actualizarMapeo(actor: Actor, planId: string, d: DatosMapeo) {
  await exigirBorrador(planId);
  return transaccion(async () => {
    await conMensajes(() => repo.reemplazarMapeo(planId, d.asignaturaId, d.competenciaIds));
    await auditar(actor, 'mapear_competencias', 'asignatura_competencias', planId, `asignatura ${d.asignaturaId}: ${d.competenciaIds.length} competencia(s)`);
    return { ok: true };
  });
}

export async function publicar(actor: Actor, planId: string) {
  const p = await exigirBorrador(planId);
  const detalle = await obtenerPlan(p.id);
  if (detalle.asignaturas === 0) throw new ValidationError('Agregue al menos una asignatura antes de publicar el plan');
  return transaccion(async () => {
    const r = await repo.publicar(planId);
    if (!r) throw new ConflictError('El plan ya fue publicado');
    await auditar(actor, 'publicar', 'planes_estudio', planId, `v${p.version}`);
    return { id: r.id, publicado_en: r.publicado_en?.toISOString() ?? null };
  });
}

/**
 * Aplica el plan a una sección con vigencia y crea un curso por cada asignatura del plan.
 * La base exige plan publicado, vigencia dentro del año, misma sección/año/grado y sin solapes.
 */
export async function asignarSeccion(actor: Actor, planId: string, d: DatosAsignarSeccion) {
  const p = await exigirPlan(planId);
  return transaccion(async () => {
    const sp = await conMensajes(() => repo.asignarSeccion(p, d.seccionId, rango(d.inicio, d.fin)));
    const cursos = await repo.crearCursosDeSeccionPlan({ id: sp.id, plan_id: p.id, seccion_id: d.seccionId });
    await auditar(actor, 'asignar_plan', 'seccion_planes_estudio', sp.id, `plan ${p.id} v${p.version} → sección ${d.seccionId} (${cursos} curso(s))`);
    return { id: sp.id, cursos };
  });
}

/** Ajusta la vigencia del plan en la sección (p. ej. para cerrar un plan y aplicar otro). La base valida. */
export async function actualizarVigenciaSeccionPlan(actor: Actor, id: string, d: { inicio: string; fin: string }) {
  const sp = await repo.obtenerSeccionPlan(id);
  if (!sp) throw new NotFoundError('La sección no tiene ese plan aplicado');
  return transaccion(async () => {
    const r = await conMensajes(() => repo.actualizarVigenciaSeccionPlan(id, rango(d.inicio, d.fin)));
    await auditar(actor, 'actualizar', 'seccion_planes_estudio', id, `vigencia ${d.inicio} – ${d.fin}`);
    return r;
  });
}
