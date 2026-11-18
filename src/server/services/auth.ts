import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '@/server/errores';
import * as repo from '@/server/repositories/identidad/auth';
import { contarEventos, registrarBitacora } from '@/server/repositories/bitacora';
import { generarToken, hashToken } from '@/server/auth/tokens';
import { hashContrasena, verificarContrasena, verificarContrasenaFicticia } from '@/server/auth/contrasenas';
import { verificarLimite, reiniciarLimite } from '@/server/auth/limite';
import { HORAS_SESION } from '@/server/auth/cookies';
import type { Actor } from '@/server/auth/actor';

const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

export function normalizarLogin(login: string): string {
  return login.trim().toLowerCase();
}

/**
 * Inicia sesión por usuarios.login. Respeta usuarios.estado, limita intentos (memoria + bitácora)
 * y registra cada intento en bitácora. Devuelve el token en claro SOLO para la cookie.
 */
export async function iniciarSesion(entrada: { login: string; contrasena: string; ip: string }) {
  const login = normalizarLogin(entrada.login);
  verificarLimite(`ip:${entrada.ip}`, 30, VENTANA_MS);
  verificarLimite(`login:${login}`, 10, VENTANA_MS);

  const usuario = await repo.buscarUsuarioPorLogin(login);
  if (!usuario) {
    await verificarContrasenaFicticia(entrada.contrasena);
    await registrarBitacora({ accion: 'login', entidad: 'usuarios', motivo: `login inexistente: ${login.slice(0, 60)}`, resultado: 'fallido' });
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }

  const fallos = await contarEventos({
    usuarioAfectadoId: usuario.id,
    accion: 'login',
    resultado: 'fallido',
    desde: new Date(Date.now() - VENTANA_MS),
  });
  if (fallos >= MAX_FALLOS) {
    await registrarBitacora({ usuarioAfectadoId: usuario.id, accion: 'login', entidad: 'usuarios', registroId: usuario.id, motivo: 'bloqueo temporal', resultado: 'bloqueado' });
    throw new UnauthorizedError('Cuenta bloqueada temporalmente por intentos fallidos. Inténtelo en 15 minutos.');
  }

  const valida = await verificarContrasena(usuario.contrasena_hash, entrada.contrasena);
  if (!valida) {
    await registrarBitacora({ usuarioAfectadoId: usuario.id, accion: 'login', entidad: 'usuarios', registroId: usuario.id, resultado: 'fallido' });
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }
  if (usuario.estado === 'pendiente') {
    throw new ForbiddenError('Su cuenta aún no está activada. Use el enlace de activación entregado por el colegio.');
  }
  if (usuario.estado === 'suspendido') {
    await registrarBitacora({ usuarioAfectadoId: usuario.id, accion: 'login', entidad: 'usuarios', registroId: usuario.id, motivo: 'cuenta suspendida', resultado: 'rechazado' });
    throw new ForbiddenError('Su cuenta está suspendida. Comuníquese con el colegio.');
  }

  const token = generarToken();
  const expiraEn = new Date(Date.now() + HORAS_SESION * 3600 * 1000);
  const sesion = await transaccion(async () => {
    const s = await repo.crearSesion({ usuarioId: usuario.id, tokenHash: hashToken(token), expiraEn });
    await repo.registrarAcceso(usuario.id);
    await registrarBitacora({ actorId: usuario.id, usuarioAfectadoId: usuario.id, accion: 'login', entidad: 'sesiones', registroId: s.id, resultado: 'ok' });
    return s;
  });
  reiniciarLimite(`login:${login}`);
  return { token, expiraEn: sesion.expira_en, usuarioId: usuario.id };
}

export async function cerrarSesion(actor: Pick<Actor, 'sesionId' | 'usuarioId'>) {
  await transaccion(async () => {
    await repo.revocarSesion(actor.sesionId);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'logout', entidad: 'sesiones', registroId: actor.sesionId, resultado: 'ok' });
  });
}

/**
 * Emite un token de activación (primer ingreso) o de recuperación. Revoca los anteriores.
 * Devuelve el token en claro UNA sola vez para entregarlo al usuario (enlace /acceso/<token>).
 */
export async function emitirTokenAcceso(entrada: {
  usuarioId: string;
  proposito: 'activacion' | 'recuperacion';
  emisorId: string | null;
  horasVigencia?: number;
}) {
  const token = generarToken();
  const expiraEn = new Date(Date.now() + (entrada.horasVigencia ?? 72) * 3600 * 1000);
  await transaccion(async () => {
    await repo.revocarTokensDeUsuario(entrada.usuarioId);
    const t = await repo.crearTokenAcceso({
      usuarioId: entrada.usuarioId,
      emisorId: entrada.emisorId,
      proposito: entrada.proposito,
      tokenHash: hashToken(token),
      expiraEn,
    });
    await registrarBitacora({
      actorId: entrada.emisorId,
      usuarioAfectadoId: entrada.usuarioId,
      accion: `emitir_${entrada.proposito}`,
      entidad: 'tokens_acceso',
      registroId: t.id,
      resultado: 'ok',
    });
  });
  return { token, expiraEn };
}

export async function consultarTokenAcceso(token: string) {
  if (!token || token.length > 100) return null;
  return repo.consultarToken(hashToken(token));
}

export function validarFortaleza(contrasena: string): void {
  if (contrasena.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(contrasena) || !/\d/.test(contrasena)) {
    throw new ValidationError('La contraseña debe tener al menos 8 caracteres, con letras y números');
  }
}

/** Consume un token (uso único): fija la contraseña, activa si estaba pendiente y cierra sesiones previas. */
export async function canjearTokenAcceso(token: string, nuevaContrasena: string) {
  validarFortaleza(nuevaContrasena);
  const hash = await hashContrasena(nuevaContrasena);
  return transaccion(async () => {
    const t = await repo.buscarTokenVigenteParaConsumir(hashToken(token));
    if (!t) throw new ConflictError('El enlace no es válido, ya fue usado o venció. Solicite uno nuevo al colegio.');
    if (t.estado === 'suspendido') throw new ForbiddenError('La cuenta está suspendida. Comuníquese con el colegio.');
    await repo.actualizarContrasena(t.usuario_id, hash, t.estado === 'pendiente');
    await repo.consumirToken(t.id);
    await repo.revocarTokensDeUsuario(t.usuario_id);
    await repo.revocarSesionesDeUsuario(t.usuario_id);
    await registrarBitacora({ actorId: t.usuario_id, usuarioAfectadoId: t.usuario_id, accion: `canjear_${t.proposito}`, entidad: 'tokens_acceso', registroId: t.id, resultado: 'ok' });
    return { login: t.login };
  });
}

export async function cambiarContrasena(actor: Pick<Actor, 'usuarioId' | 'sesionId'>, actual: string, nueva: string) {
  validarFortaleza(nueva);
  const hashActual = await repo.obtenerHashContrasena(actor.usuarioId);
  if (!(await verificarContrasena(hashActual, actual))) throw new ValidationError('La contraseña actual no es correcta');
  const hash = await hashContrasena(nueva);
  await transaccion(async () => {
    await repo.actualizarContrasena(actor.usuarioId, hash, false);
    await repo.revocarSesionesDeUsuario(actor.usuarioId, actor.sesionId);
    await registrarBitacora({ actorId: actor.usuarioId, usuarioAfectadoId: actor.usuarioId, accion: 'cambiar_contrasena', entidad: 'usuarios', registroId: actor.usuarioId, resultado: 'ok' });
  });
}

/** Sin correo configurado: la solicitud queda en bitácora para que secretaría emita el enlace. */
export async function solicitarRecuperacion(login: string, ip: string) {
  verificarLimite(`recuperar:${ip}`, 5, VENTANA_MS);
  const usuario = await repo.buscarUsuarioPorLogin(normalizarLogin(login));
  await registrarBitacora({
    usuarioAfectadoId: usuario?.id ?? null,
    accion: 'solicitar_recuperacion',
    entidad: 'usuarios',
    registroId: usuario?.id ?? null,
    motivo: usuario ? null : `login inexistente: ${normalizarLogin(login).slice(0, 60)}`,
    resultado: 'pendiente',
  });
}
