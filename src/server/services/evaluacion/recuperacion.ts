import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/evaluacion/recuperacion';
import type { Actor } from '@/server/auth/actor';
import type { DatosRecuperacion } from '@/esquemas/evaluacion/recuperacion';

// Recuperación y subsanación sobre competencias pendientes de un cierre anual aprobado.
// Todas las reglas (pendiente, aprobado, fecha ≥ corte, borrador → aprobada inmutable) las impone la base.

export const listarPendientes = repo.listarPendientes;

export async function registrarEvaluacion(actor: Actor, d: DatosRecuperacion) {
  return transaccion(async () => {
    const r = await repo.crearEvaluacion({ ...d, registradoPor: actor.usuarioId });
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'evaluaciones_recuperacion', registroId: r.id, motivo: `intento ${r.intento}`, resultado: 'ok' });
    return r;
  });
}

export async function editarEvaluacion(actor: Actor, id: string, d: Omit<DatosRecuperacion, 'resultadoOrigenId'>) {
  return transaccion(async () => {
    const r = await repo.editarEvaluacion(id, d);
    if (!r) throw new NotFoundError('La evaluación de recuperación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'evaluaciones_recuperacion', registroId: id, resultado: 'ok' });
    return r;
  });
}

/** Aprobación: la base la audita (auditar_recuperacion). */
export async function aprobarEvaluacion(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.aprobarEvaluacion(id, actor.usuarioId);
    if (!r) throw new NotFoundError('La evaluación de recuperación no existe');
    return r;
  });
}
