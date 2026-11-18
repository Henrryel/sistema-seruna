import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/academico/secciones';
import type { Actor } from '@/server/auth/actor';
import type { DatosAula, DatosSeccion } from '@/esquemas/academico/secciones';
import { conMensajes } from './restricciones';

// Secciones (cupo/reserva/nombre los valida la base), grados de solo lectura y aulas.

export const listarSecciones = repo.listarSecciones;
export const listarGrados = repo.listarGrados;
export const listarAulas = repo.listarAulas;

export async function obtenerSeccion(id: string) {
  const s = await repo.obtenerSeccion(id);
  if (!s) throw new NotFoundError('La sección no existe');
  return s;
}

export async function crearSeccion(actor: Actor, d: DatosSeccion) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.crearSeccion(d));
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'secciones', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarSeccion(actor: Actor, id: string, d: DatosSeccion) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.actualizarSeccion(id, d));
    if (!r) throw new NotFoundError('La sección no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'secciones', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function crearAula(actor: Actor, d: DatosAula) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.crearAula(d));
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'aulas', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarAula(actor: Actor, id: string, d: DatosAula) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.actualizarAula(id, d));
    if (!r) throw new NotFoundError('El aula no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'aulas', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function eliminarAula(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.eliminarAula(id));
    if (!r) throw new NotFoundError('El aula no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'aulas', registroId: id, resultado: 'ok' });
    return r;
  });
}
