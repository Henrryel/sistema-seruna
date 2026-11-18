import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import { emitirTokenAcceso } from '@/server/services/auth';
import * as repo from '@/server/repositories/identidad/usuarios';
import * as personas from '@/server/repositories/identidad/personas';
import type { Actor } from '@/server/auth/actor';
import type { DatosCrearUsuario, EnlaceAcceso } from '@/esquemas/identidad/usuarios';

// Cuentas de usuario: alta (estado pendiente, sin contraseña), roles, suspensión/reactivación, enlaces de
// activación/recuperación (tokens_acceso: solo se guarda el hash) y cierre de sesiones. Todo auditado.

const PERMISO_GESTION = 'usuarios.gestionar';

export const listarUsuarios = repo.listarUsuarios;
export const listarRoles = repo.listarRoles;

export async function obtenerUsuario(id: string) {
  const u = await repo.obtenerDetalleUsuario(id);
  if (!u) throw new NotFoundError('El usuario no existe');
  return u;
}

async function exigirUsuario(id: string) {
  const u = await repo.obtenerUsuario(id);
  if (!u) throw new NotFoundError('El usuario no existe');
  return u;
}

async function resolverRoles(codigos: string[]) {
  const unicos = [...new Set(codigos)];
  const roles = await repo.rolesPorCodigo(unicos);
  const faltantes = unicos.filter((c) => !roles.some((r) => r.codigo === c));
  if (faltantes.length > 0) throw new ValidationError(`Rol inexistente: ${faltantes.join(', ')}`);
  return roles;
}

/** URL pública del enlace de un solo uso (APP_URL si está configurada; si no, el origen de la petición). */
export function urlAcceso(origen: string, token: string): string {
  const base = (process.env.APP_URL || origen).replace(/\/+$/, '');
  return `${base}/acceso/${token}`;
}

export async function crearUsuario(actor: Actor, datos: DatosCrearUsuario, origen: string) {
  const persona = await personas.obtenerPersona(datos.personaId);
  if (!persona) throw new NotFoundError('La persona no existe');
  const roles = await resolverRoles(datos.roles);
  return transaccion(async () => {
    const u = await repo.crearUsuario({ personaId: datos.personaId, login: datos.login });
    for (const r of roles) await repo.agregarRol(u.id, r.id);
    await registrarBitacora({
      actorId: actor.usuarioId,
      usuarioAfectadoId: u.id,
      accion: 'crear',
      entidad: 'usuarios',
      registroId: u.id,
      motivo: `roles: ${roles.map((r) => r.codigo).join(', ')}`,
      resultado: 'ok',
    });
    const enlace = datos.generarEnlace ? await generarEnlace(actor, u.id, { proposito: 'activacion' }, origen) : null;
    return { id: u.id, login: datos.login, estado: 'pendiente' as const, enlace };
  });
}

/** Reemplaza los roles del usuario (agrega y quita la diferencia, auditando cada cambio). */
export async function actualizarRoles(actor: Actor, usuarioId: string, codigos: string[]) {
  await exigirUsuario(usuarioId);
  const nuevos = await resolverRoles(codigos);
  if (usuarioId === actor.usuarioId) {
    const permisos = await repo.permisosDeRoles(nuevos.map((r) => r.codigo));
    if (!permisos.includes(PERMISO_GESTION)) {
      throw new ForbiddenError('No puede quitarse a sí mismo el permiso de gestionar usuarios');
    }
  }
  return transaccion(async () => {
    const actuales = await repo.codigosRolesDeUsuario(usuarioId);
    for (const r of nuevos.filter((n) => !actuales.some((a) => a.id === n.id))) {
      await repo.agregarRol(usuarioId, r.id);
      await registrarBitacora({ actorId: actor.usuarioId, usuarioAfectadoId: usuarioId, accion: 'asignar_rol', entidad: 'usuario_roles', registroId: usuarioId, motivo: r.codigo, resultado: 'ok' });
    }
    for (const r of actuales.filter((a) => !nuevos.some((n) => n.id === a.id))) {
      await repo.quitarRol(usuarioId, r.id);
      await registrarBitacora({ actorId: actor.usuarioId, usuarioAfectadoId: usuarioId, accion: 'quitar_rol', entidad: 'usuario_roles', registroId: usuarioId, motivo: r.codigo, resultado: 'ok' });
    }
    return { roles: nuevos.map((r) => r.codigo).sort() };
  });
}

/**
 * Suspende o reactiva la cuenta. Al reactivar, 'activo' exige contraseña (CHECK de la base): si la cuenta
 * nunca fue activada, vuelve a 'pendiente' para que use su enlace de activación.
 */
export async function cambiarEstado(actor: Actor, usuarioId: string, datos: { estado: 'activo' | 'suspendido'; motivo: string | null }) {
  if (usuarioId === actor.usuarioId && datos.estado === 'suspendido') throw new ForbiddenError('No puede suspender su propia cuenta');
  const u = await exigirUsuario(usuarioId);
  return transaccion(async () => {
    if (datos.estado === 'suspendido') {
      await repo.cambiarEstado(usuarioId, 'suspendido');
      const sesiones = await repo.revocarSesiones(usuarioId);
      await repo.revocarTokens(usuarioId);
      await registrarBitacora({
        actorId: actor.usuarioId,
        usuarioAfectadoId: usuarioId,
        accion: 'suspender',
        entidad: 'usuarios',
        registroId: usuarioId,
        motivo: `${datos.motivo ?? ''}${sesiones ? ` (${sesiones} sesión(es) cerrada(s))` : ''}`.trim() || null,
        resultado: 'ok',
      });
      return { estado: 'suspendido' as const };
    }
    const estado = u.tiene_contrasena ? ('activo' as const) : ('pendiente' as const);
    await repo.cambiarEstado(usuarioId, estado);
    await registrarBitacora({
      actorId: actor.usuarioId,
      usuarioAfectadoId: usuarioId,
      accion: 'reactivar',
      entidad: 'usuarios',
      registroId: usuarioId,
      motivo: [datos.motivo, `queda ${estado}`].filter(Boolean).join(' · '),
      resultado: 'ok',
    });
    return { estado };
  });
}

/**
 * Genera un enlace de activación o recuperación (token de un solo uso; revoca los anteriores).
 * La URL se devuelve UNA sola vez: en la base solo queda el hash. emitirTokenAcceso audita la emisión.
 */
export async function generarEnlace(
  actor: Actor,
  usuarioId: string,
  datos: { proposito?: 'activacion' | 'recuperacion'; horasVigencia?: number },
  origen: string,
): Promise<EnlaceAcceso> {
  const u = await exigirUsuario(usuarioId);
  if (u.estado === 'suspendido') throw new ConflictError('La cuenta está suspendida. Reactívela antes de generar un enlace de acceso.');
  const proposito = datos.proposito ?? (u.estado === 'pendiente' || !u.tiene_contrasena ? 'activacion' : 'recuperacion');
  const { token, expiraEn } = await emitirTokenAcceso({ usuarioId, proposito, emisorId: actor.usuarioId, horasVigencia: datos.horasVigencia });
  return { url: urlAcceso(origen, token), expiraEn: expiraEn.toISOString(), proposito };
}

/** Cierra las sesiones abiertas del usuario (si es uno mismo, conserva la sesión actual). */
export async function revocarSesiones(actor: Actor, usuarioId: string) {
  await exigirUsuario(usuarioId);
  return transaccion(async () => {
    const n = await repo.revocarSesiones(usuarioId, usuarioId === actor.usuarioId ? actor.sesionId : undefined);
    await registrarBitacora({ actorId: actor.usuarioId, usuarioAfectadoId: usuarioId, accion: 'revocar_sesiones', entidad: 'sesiones', registroId: usuarioId, motivo: `${n} sesión(es)`, resultado: 'ok' });
    return { revocadas: n };
  });
}
