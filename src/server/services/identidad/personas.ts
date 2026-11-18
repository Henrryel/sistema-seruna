import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/identidad/personas';
import type { Actor } from '@/server/auth/actor';
import type { DatosCrearPersona, DatosDocumento, DatosPersona } from '@/esquemas/identidad/personas';

// Personas y documentos de identidad. Las reglas (DNI 8 dígitos y país PE, número en mayúsculas,
// documento único por tipo/país) las valida la base; los errores se traducen solos.

export const listarPersonas = repo.listarPersonas;

export async function obtenerPersona(id: string) {
  const p = await repo.obtenerPersona(id);
  if (!p) throw new NotFoundError('La persona no existe');
  return p;
}

export async function crearPersona(actor: Actor, datos: DatosCrearPersona) {
  return transaccion(async () => {
    const p = await repo.crearPersona(datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'personas', registroId: p.id, resultado: 'ok' });
    if (datos.documento) {
      const d = await repo.crearDocumento(p.id, datos.documento);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'documentos_identidad', registroId: d.id, motivo: `persona ${p.id}`, resultado: 'ok' });
    }
    return p;
  });
}

export async function actualizarPersona(actor: Actor, id: string, datos: DatosPersona) {
  return transaccion(async () => {
    const r = await repo.actualizarPersona(id, datos);
    if (!r) throw new NotFoundError('La persona no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'personas', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function agregarDocumento(actor: Actor, personaId: string, datos: DatosDocumento) {
  await obtenerPersona(personaId);
  return transaccion(async () => {
    const d = await repo.crearDocumento(personaId, datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'documentos_identidad', registroId: d.id, motivo: `persona ${personaId}`, resultado: 'ok' });
    return d;
  });
}

export async function actualizarDocumento(actor: Actor, id: string, datos: DatosDocumento) {
  return transaccion(async () => {
    const d = await repo.actualizarDocumento(id, datos);
    if (!d) throw new NotFoundError('El documento no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'documentos_identidad', registroId: id, motivo: `persona ${d.persona_id}`, resultado: 'ok' });
    return d;
  });
}

export async function eliminarDocumento(actor: Actor, id: string) {
  return transaccion(async () => {
    const d = await repo.eliminarDocumento(id);
    if (!d) throw new NotFoundError('El documento no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'documentos_identidad', registroId: id, motivo: `persona ${d.persona_id}`, resultado: 'ok' });
    return d;
  });
}
