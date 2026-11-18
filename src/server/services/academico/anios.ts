import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/academico/anios';
import type { Actor } from '@/server/auth/actor';
import type { DatosAnio, DatosBimestre } from '@/esquemas/academico/anios';

// Servicio: orquesta transacción + auditoría. Las reglas (fechas, solapes de bimestres, 1..4)
// las impone la base (CHECK y EXCLUDE); aquí NO se duplican.

export const listarAnios = repo.listarAnios;
export const listarBimestres = repo.listarBimestres;

export async function obtenerAnio(id: string) {
  const anio = await repo.obtenerAnio(id);
  if (!anio) throw new NotFoundError('El año académico no existe');
  return anio;
}

export async function crearAnio(actor: Actor, datos: DatosAnio) {
  return transaccion(async () => {
    const r = await repo.crearAnio(datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'anios_academicos', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarAnio(actor: Actor, id: string, datos: DatosAnio) {
  return transaccion(async () => {
    const r = await repo.actualizarAnio(id, datos);
    if (!r) throw new NotFoundError('El año académico no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'anios_academicos', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function crearBimestre(actor: Actor, anioId: string, datos: DatosBimestre) {
  await obtenerAnio(anioId);
  return transaccion(async () => {
    const r = await repo.crearBimestre(anioId, datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'bimestres', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarBimestre(actor: Actor, id: string, datos: DatosBimestre) {
  return transaccion(async () => {
    const r = await repo.actualizarBimestre(id, datos);
    if (!r) throw new NotFoundError('El bimestre no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'bimestres', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function eliminarBimestre(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.eliminarBimestre(id);
    if (!r) throw new NotFoundError('El bimestre no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'bimestres', registroId: id, resultado: 'ok' });
    return r;
  });
}
