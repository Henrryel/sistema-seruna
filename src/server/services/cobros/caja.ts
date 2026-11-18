import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import { tienePermiso } from '@/server/autorizacion/permisos';
import * as repo from '@/server/repositories/cobros/caja';
import type { Actor } from '@/server/auth/actor';
import type { DatosAbrirSesion, DatosCaja, DatosCerrarSesion, DatosSerie, SesionActual } from '@/esquemas/cobros/caja';
import { formatoMoneda } from '@/lib/formato';

// Servicio: cajas, series de recibos y sesiones de caja. La unicidad de la sesión abierta por caja
// (índice parcial) y los CHECK de saldos los impone la base.

export const listarCajas = repo.listarCajas;
export const listarSeries = repo.listarSeries;
export const listarSesiones = repo.listarSesiones;

export async function crearCaja(actor: Actor, datos: DatosCaja) {
  return transaccion(async () => {
    const r = await repo.crearCaja(datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'cajas', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarCaja(actor: Actor, id: string, datos: DatosCaja) {
  return transaccion(async () => {
    const r = await repo.actualizarCaja(id, datos);
    if (!r) throw new NotFoundError('La caja no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'cajas', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function crearSerie(actor: Actor, datos: DatosSerie) {
  return transaccion(async () => {
    const r = await repo.crearSerie(datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'series_recibos', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

/** Una serie con recibos emitidos conserva código y correlativo: solo se activa o desactiva. */
export async function actualizarSerie(actor: Actor, id: string, datos: DatosSerie) {
  return transaccion(async () => {
    const s = await repo.obtenerSerie(id);
    if (!s) throw new NotFoundError('La serie no existe');
    const conRecibos = Number(s.recibos ?? 0) > 0;
    if (conRecibos && (s.codigo !== datos.codigo || Number(s.numero_inicial) !== datos.numeroInicial)) {
      throw new ConflictError('La serie ya tiene recibos emitidos: solo puede activarla o desactivarla');
    }
    const r = conRecibos ? await repo.cambiarActivaSerie(id, datos.activa) : await repo.actualizarSerieCompleta(id, datos);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'series_recibos', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function abrirSesion(actor: Actor, datos: DatosAbrirSesion) {
  return transaccion(async () => {
    const caja = await repo.obtenerCaja(datos.cajaId);
    if (!caja) throw new NotFoundError('La caja no existe');
    if (!caja.activa) throw new ValidationError('La caja está inactiva');
    const propia = await repo.sesionAbiertaDeOperador(actor.usuarioId);
    if (propia) throw new ConflictError('Ya tiene una sesión de caja abierta: ciérrela antes de abrir otra');
    const r = await repo.abrirSesion(datos.cajaId, actor.usuarioId, datos.saldoInicial);
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'abrir_caja',
      entidad: 'sesiones_caja',
      registroId: r.id,
      motivo: `${caja.nombre} con saldo inicial ${formatoMoneda(datos.saldoInicial)}`,
      resultado: 'ok',
    });
    return r;
  });
}

/** Sesión abierta del operador con su arqueo en curso. */
export async function sesionActual(actor: Actor): Promise<SesionActual> {
  const s = await repo.sesionAbiertaDeOperador(actor.usuarioId);
  if (!s) return { sesion: null, arqueo: null };
  const { filas } = await repo.listarSesiones({ id: s.id }, { limite: 1, desplazamiento: 0 });
  return { sesion: filas[0] ?? null, arqueo: (await repo.arqueoSesion(s.id)) ?? null };
}

export async function arqueo(id: string) {
  const a = await repo.arqueoSesion(id);
  if (!a) throw new NotFoundError('La sesión de caja no existe');
  const { filas } = await repo.listarSesiones({ id }, { limite: 1, desplazamiento: 0 });
  return { sesion: filas[0] ?? null, arqueo: a };
}

/** Cierre con arqueo: saldo contado frente al esperado (inicial + efectivo − devoluciones en efectivo). */
export async function cerrarSesion(actor: Actor, id: string, datos: DatosCerrarSesion) {
  return transaccion(async () => {
    const s = await repo.bloquearSesion(id);
    if (!s) throw new NotFoundError('La sesión de caja no existe');
    if (s.cerrada_en) throw new ConflictError('La sesión de caja ya está cerrada');
    if (s.operador_id !== actor.usuarioId && !tienePermiso(actor, 'tesoreria.revertir')) {
      throw new ForbiddenError('Solo el operador de la sesión (o un supervisor de tesorería) puede cerrarla');
    }
    const r = await repo.cerrarSesion(id, datos.saldoContado);
    if (!r) throw new ConflictError('La sesión de caja ya está cerrada');
    const a = await repo.arqueoSesion(id);
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'cerrar_caja',
      entidad: 'sesiones_caja',
      registroId: id,
      motivo: a ? `Esperado ${formatoMoneda(a.esperado)}, contado ${formatoMoneda(a.saldo_contado)}, diferencia ${formatoMoneda(a.diferencia)}` : null,
      resultado: 'ok',
    });
    return a;
  });
}
