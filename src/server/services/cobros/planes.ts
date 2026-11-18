import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/cobros/planes';
import type { Actor } from '@/server/auth/actor';
import {
  finDeMes,
  type DatosEditarObligacion,
  type DatosEditarPlan,
  type DatosGenerarPensiones,
  type DatosObligacion,
  type DatosPlan,
  type DatosTramo,
} from '@/esquemas/cobros/planes';
import { sumarDias } from '@/lib/formato';

// Servicio: planes de cobro versionados. Las reglas de tramos (CHECK) y la emisión exacta las valida la base;
// aquí solo se protege la inmutabilidad de un plan ya publicado (cambios = nueva versión).

export const listarPlanes = repo.listarPlanes;
export const listarTramos = repo.listarTramos;
export const condicionesPublicadas = repo.condicionesPublicadas;
export const listarObligaciones = repo.listarObligaciones;

export async function obtenerPlan(id: string) {
  const plan = await repo.obtenerPlan(id);
  if (!plan) throw new NotFoundError('El plan de cobro no existe');
  return { plan, tramos: await repo.listarTramos(id) };
}

/** Condición económica a usar: la indicada (debe ser del año y estar publicada) o la vigente del año. */
async function resolverCondiciones(anioId: string, condicionesId: string | undefined): Promise<string | null> {
  const publicadas = await repo.condicionesPublicadas(anioId);
  if (condicionesId) {
    if (!publicadas.some((c) => c.id === condicionesId)) {
      throw new ValidationError('Las condiciones económicas deben ser un documento publicado del mismo año');
    }
    return condicionesId;
  }
  return publicadas[0]?.id ?? null;
}

async function exigirBorrador(planId: string) {
  const plan = await repo.bloquearPlan(planId);
  if (!plan) throw new NotFoundError('El plan de cobro no existe');
  if (plan.publicado_en) throw new ConflictError('El plan ya está publicado: cree una nueva versión para modificarlo');
  return plan;
}

export async function crearPlan(actor: Actor, datos: DatosPlan) {
  return transaccion(async () => {
    const condicionesId = await resolverCondiciones(datos.anioId, datos.condicionesId);
    const version = await repo.siguienteVersion(datos.anioId, datos.gradoId);
    const r = await repo.crearPlan({ ...datos, condicionesId }, version);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'planes_cobro', registroId: r.id, resultado: 'ok' });
    return { id: r.id, version };
  });
}

export async function actualizarPlan(actor: Actor, id: string, datos: DatosEditarPlan) {
  return transaccion(async () => {
    const plan = await exigirBorrador(id);
    const condicionesId = datos.condicionesId
      ? await resolverCondiciones(plan.anio_id, datos.condicionesId)
      : (plan.condiciones_id ?? (await resolverCondiciones(plan.anio_id, undefined)));
    const r = await repo.actualizarPlanBorrador(id, { ...datos, condicionesId });
    if (!r) throw new NotFoundError('El plan de cobro no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'planes_cobro', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function publicarPlan(actor: Actor, id: string) {
  return transaccion(async () => {
    const plan = await exigirBorrador(id);
    const tramos = await repo.listarTramos(id);
    if (tramos.length === 0) throw new ValidationError('Agregue al menos un tramo antes de publicar el plan');
    const condicionesId = plan.condiciones_id ?? (await resolverCondiciones(plan.anio_id, undefined));
    if (!condicionesId) throw new ValidationError('No hay condiciones económicas publicadas para el año: publíquelas antes del plan de cobro');
    const r = await repo.publicarPlan(id, condicionesId);
    if (!r) throw new ConflictError('El plan ya fue publicado');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'publicar', entidad: 'planes_cobro', registroId: id, resultado: 'ok' });
    return { id, publicadoEn: r.publicado_en };
  });
}

/** Nueva versión (borrador) copiando el plan y sus tramos. */
export async function nuevaVersion(actor: Actor, id: string) {
  return transaccion(async () => {
    const plan = await repo.bloquearPlan(id);
    if (!plan) throw new NotFoundError('El plan de cobro no existe');
    const version = await repo.siguienteVersion(plan.anio_id, plan.grado_id);
    const r = await repo.copiarComoNuevaVersion(id, version);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear_version', entidad: 'planes_cobro', registroId: r.id, motivo: `Desde el plan ${id}`, resultado: 'ok' });
    return { id: r.id, version };
  });
}

export async function crearTramo(actor: Actor, planId: string, datos: DatosTramo) {
  return transaccion(async () => {
    const plan = await exigirBorrador(planId);
    const r = await repo.crearTramo(plan, datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'tramos_plan_cobro', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

async function tramoDeBorrador(id: string) {
  const tramo = await repo.obtenerTramo(id);
  if (!tramo) throw new NotFoundError('El tramo no existe');
  await exigirBorrador(tramo.plan_id);
  return tramo;
}

export async function actualizarTramo(actor: Actor, id: string, datos: DatosTramo) {
  return transaccion(async () => {
    await tramoDeBorrador(id);
    const r = await repo.actualizarTramo(id, datos);
    if (!r) throw new NotFoundError('El tramo no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'tramos_plan_cobro', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function eliminarTramo(actor: Actor, id: string) {
  return transaccion(async () => {
    await tramoDeBorrador(id);
    const r = await repo.eliminarTramo(id);
    if (!r) throw new NotFoundError('El tramo no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'tramos_plan_cobro', registroId: id, resultado: 'ok' });
    return r;
  });
}

/**
 * Genera las pensiones mensuales (por defecto 10) reemplazando las del borrador.
 * Cada pensión es exigible desde el último día de su mes de servicio (como exige la base) y vence
 * ese día más los días de gracia.
 */
export async function generarPensiones(actor: Actor, planId: string, datos: DatosGenerarPensiones) {
  return transaccion(async () => {
    const plan = await exigirBorrador(planId);
    const detalle = await repo.obtenerPlan(planId);
    const importe = datos.importe ?? detalle?.pension_referencia ?? null;
    if (!importe) throw new ValidationError('Indique el importe de la pensión o la pensión de referencia del plan');
    await repo.eliminarPensiones(planId);
    const [anio, mes] = datos.mesInicio.split('-').map(Number) as [number, number];
    const creados: string[] = [];
    for (let i = 0; i < datos.cantidad; i++) {
      const fecha = new Date(Date.UTC(anio, mes - 1 + i, 1));
      const mesServicio = fecha.toISOString().slice(0, 10);
      const exigible = finDeMes(mesServicio);
      const r = await repo.crearTramo(plan, {
        concepto: 'pension',
        numero: i + 1,
        importe,
        mesServicio,
        exigibleDesde: exigible,
        venceEn: sumarDias(exigible, datos.diasGracia),
      });
      creados.push(r.id);
    }
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'generar_pensiones',
      entidad: 'planes_cobro',
      registroId: planId,
      motivo: `${datos.cantidad} pensiones desde ${datos.mesInicio}`,
      resultado: 'ok',
    });
    return { creados: creados.length };
  });
}

// ---------- Obligaciones de ingreso ----------

export async function crearObligacion(actor: Actor, datos: DatosObligacion) {
  return transaccion(async () => {
    const m = await repo.matriculaBasica(datos.matriculaId);
    if (!m) throw new NotFoundError('La matrícula no existe');
    const condicionesId = await resolverCondiciones(m.anio_id, datos.condicionesId);
    if (!condicionesId) throw new ValidationError('No hay condiciones económicas publicadas para el año de la matrícula');
    const r = await repo.crearObligacion({ estudianteId: m.estudiante_id, matriculaId: m.id, importeAcordado: datos.importeAcordado, condicionesId });
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'obligaciones_ingreso', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarObligacion(actor: Actor, id: string, datos: DatosEditarObligacion) {
  return transaccion(async () => {
    const o = await repo.obtenerObligacion(id);
    if (!o) throw new NotFoundError('La obligación de ingreso no existe');
    if (Number(o.cuotas ?? 0) > 0) throw new ConflictError('Ya se emitieron cuotas de ingreso: corrija con ajustes de cuota');
    const m = await repo.matriculaBasica(o.matricula_ingreso_id);
    if (!m) throw new NotFoundError('La matrícula no existe');
    const condicionesId = datos.condicionesId ? ((await resolverCondiciones(m.anio_id, datos.condicionesId)) ?? o.condiciones_id) : o.condiciones_id;
    const r = await repo.actualizarObligacion(id, { importeAcordado: datos.importeAcordado, condicionesId });
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'obligaciones_ingreso', registroId: id, resultado: 'ok' });
    return r;
  });
}
