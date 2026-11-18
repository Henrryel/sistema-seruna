import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { guardarArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/evaluacion/reglas';
import type { Actor } from '@/server/auth/actor';
import type { DatosRegla } from '@/esquemas/evaluacion/reglas';

// Reglas de evaluación anual: versionadas por año y grado; aprobadas = inmutables (lo impone la base con
// `proteger_regla_evaluacion`). Los criterios se validan con el esquema Zod documentado en criterios.ts.

export const listarReglas = repo.listarReglas;

export async function obtenerRegla(id: string) {
  const r = await repo.obtenerRegla(id);
  if (!r) throw new NotFoundError('La regla de evaluación no existe');
  return r;
}

export async function crearRegla(actor: Actor, d: DatosRegla) {
  return transaccion(async () => {
    const r = await repo.crearRegla(d);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'reglas_evaluacion', registroId: r.id, motivo: `versión ${r.version}`, resultado: 'ok' });
    return r;
  });
}

export async function actualizarRegla(actor: Actor, id: string, d: Pick<DatosRegla, 'referenciaNormativa' | 'criterios'>) {
  return transaccion(async () => {
    const r = await repo.actualizarRegla(id, d);
    if (!r) throw new NotFoundError('La regla de evaluación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'reglas_evaluacion', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function aprobarRegla(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.aprobarRegla(id, actor.usuarioId);
    if (!r) throw new NotFoundError('La regla de evaluación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'aprobar', entidad: 'reglas_evaluacion', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function eliminarRegla(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.eliminarRegla(id);
    if (!r) throw new NotFoundError('La regla de evaluación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'reglas_evaluacion', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function adjuntarEvidencia(actor: Actor, id: string, archivo: { contenido: Buffer; nombreOriginal: string; tipoMime: string }) {
  await obtenerRegla(id);
  return transaccion(async () => {
    const a = await guardarArchivo(archivo);
    const r = await repo.fijarEvidencia(id, a.id);
    if (!r) throw new NotFoundError('La regla de evaluación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'adjuntar_evidencia', entidad: 'reglas_evaluacion', registroId: id, resultado: 'ok' });
    return { archivoId: a.id };
  });
}
