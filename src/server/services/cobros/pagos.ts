import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError, aErrorDominio } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import * as repo from '@/server/repositories/cobros/pagos';
import * as cuotas from '@/server/repositories/cobros/cuotas';
import * as caja from '@/server/repositories/cobros/caja';
import { generarReciboPdf } from '@/server/pdf/cobros/recibo';
import type { Actor } from '@/server/auth/actor';
import {
  distribuirPorRegla,
  medioParaBase,
  type CuentaCobro,
  type DatosComprobante,
  type DatosDevolucion,
  type DatosPago,
  type DatosReversion,
  type ResultadoPago,
} from '@/esquemas/cobros/pagos';
import type { CuotaConSaldo } from '@/esquemas/cobros/pagos';
import { aCentimos, deCentimos, numeroRecibo } from '@/esquemas/cobros/dinero';
import { formatoMoneda, hoyLima } from '@/lib/formato';

// Servicio de cobro. Un pago se registra en UNA transacción: pago → aplicaciones → emitir_recibo_caja.
// La base valida abonos (saldo, exigibilidad, importe del pago), el recibo (pago totalmente aplicado y
// correlativo con bloqueo) y la inmutabilidad; aquí no se duplican esas reglas.

export const listarPagos = repo.listarPagos;
export const buscarAlumnos = repo.buscarAlumnos;

export async function obtenerPago(id: string) {
  const d = await repo.obtenerDetallePago(id);
  if (!d) throw new NotFoundError('El pago no existe');
  return d;
}

/** Cuenta del alumno para cobrar: matrículas, cuotas con saldo de la elegida y apoderados (pagantes). */
export async function cuentaParaCobro(estudianteId: string, matriculaId?: string): Promise<CuentaCobro> {
  const alumno = await repo.estudianteBasico(estudianteId);
  if (!alumno) throw new NotFoundError('El estudiante no existe');
  const matriculas = await repo.matriculasDeEstudiante(estudianteId);
  const matricula = matriculaId ? matriculas.find((m) => m.id === matriculaId) : (matriculas.find((m) => m.estado === 'activa') ?? matriculas[0]);
  if (matriculaId && !matricula) throw new NotFoundError('La matrícula no corresponde al estudiante');
  return {
    alumno,
    matriculas,
    matricula: matricula ?? null,
    cuotas: matricula ? await cuotas.cuotasDeMatricula(matricula.id, true) : [],
    apoderados: await repo.apoderadosDeEstudiante(estudianteId),
    hoy: hoyLima(),
  };
}

/**
 * Imputación por regla: más antigua primero (vencimiento, exigibilidad, concepto, número) sobre las
 * cuotas exigibles con saldo. Si sobra importe se carga a la última cuota para que la base lo rechace
 * con su propio mensaje ("El abono excede el saldo de la cuota").
 */
export function imputarPorRegla(importe: string, candidatas: CuotaConSaldo[], hoy: string) {
  const { exigibles, aplicaciones, excedente } = distribuirPorRegla(importe, candidatas, hoy);
  if (exigibles === 0) throw new ValidationError('No hay cuotas exigibles con saldo pendiente para imputar el pago');
  const ultima = aplicaciones[aplicaciones.length - 1];
  if (excedente > 0 && ultima) ultima.centimos += excedente;
  return aplicaciones.map((a) => ({ cuotaId: a.cuotaId, importe: deCentimos(a.centimos) }));
}

function resultadoDe(p: { id: string; recibo_id: string | null; serie: string | null; numero: string | null }, repetido: boolean): ResultadoPago {
  return { pagoId: p.id, reciboId: p.recibo_id ?? '', recibo: numeroRecibo(p.serie, p.numero), repetido };
}

function esClaveRepetida(e: unknown) {
  const err = aErrorDominio(e);
  return err.codigoDb === '23505' && (err.detalles as { restriccion?: string } | undefined)?.restriccion === 'pagos_clave_idempotencia_key';
}

/** Registra un pago idempotente: con la misma clave devuelve el mismo pago y recibo. */
export async function registrarPago(actor: Actor, datos: DatosPago): Promise<ResultadoPago> {
  const previo = await repo.pagoPorClave(datos.claveIdempotencia);
  if (previo) return resultadoDe(previo, true);
  try {
    return await transaccion(async () => {
      const sesion = await caja.sesionAbiertaDeOperador(actor.usuarioId);
      if (datos.medio === 'efectivo' && !sesion) throw new ValidationError('Para cobrar en efectivo abra primero su sesión de caja');

      let aplicaciones: { cuotaId: string; importe: string }[];
      if (datos.imputacion === 'eleccion_pagante') {
        const elegidas = await repo.cuotasPorIds(datos.aplicaciones.map((a) => a.cuotaId));
        if (elegidas.length !== datos.aplicaciones.length || elegidas.some((c) => c.matricula_id !== datos.matriculaId)) {
          throw new ValidationError('Las cuotas elegidas deben pertenecer a la matrícula seleccionada');
        }
        aplicaciones = datos.aplicaciones;
      } else {
        const todas = await cuotas.cuotasDeMatricula(datos.matriculaId, true);
        const candidatas = datos.cuotas.length ? todas.filter((c) => datos.cuotas.includes(c.id)) : todas;
        aplicaciones = imputarPorRegla(datos.importe, candidatas, hoyLima());
      }

      const { medio, referencia } = medioParaBase(datos.medio, datos.referencia);
      const pago = await repo.insertarPago({
        claveIdempotencia: datos.claveIdempotencia,
        sesionCajaId: sesion?.id ?? null,
        registradoPor: actor.usuarioId,
        pagante: datos.pagante,
        importe: datos.importe,
        medio,
        referencia,
      });
      for (const a of aplicaciones) await repo.insertarAplicacion(pago.id, a.cuotaId, a.importe, datos.imputacion);
      const recibo = await repo.emitirRecibo(pago.id, datos.serieId, actor.usuarioId).catch((e: unknown) => {
        // emitir_recibo_caja toma el correlativo con UPDATE ... WHERE activa INTO STRICT: P0002 = serie inexistente o inactiva.
        if (aErrorDominio(e).codigoDb === 'P0002') throw new ValidationError('La serie de recibos elegida no existe o está inactiva');
        throw e;
      });
      await registrarBitacora({
        actorId: actor.usuarioId,
        accion: 'cobrar',
        entidad: 'pagos',
        registroId: pago.id,
        motivo: `${formatoMoneda(datos.importe)} ${datos.medio} · recibo ${numeroRecibo(recibo.serie, recibo.numero)}`,
        resultado: 'ok',
      });
      return resultadoDe({ id: pago.id, recibo_id: recibo.id, serie: recibo.serie, numero: recibo.numero }, false);
    });
  } catch (e) {
    // Carrera entre dos envíos con la misma clave: el segundo devuelve el pago del primero.
    if (esClaveRepetida(e)) {
      const ganador = await repo.pagoPorClave(datos.claveIdempotencia);
      if (ganador) return resultadoDe(ganador, true);
    }
    throw e;
  }
}

/** Reversión total: el saldo de las cuotas se reabre (saldos_cuotas excluye pagos revertidos). */
export async function revertirPago(actor: Actor, pagoId: string, datos: DatosReversion) {
  return transaccion(async () => {
    const p = await repo.bloquearPago(pagoId);
    if (!p) throw new NotFoundError('El pago no existe');
    if (p.revertido) throw new ConflictError('El pago ya fue revertido');
    if (p.con_devoluciones) throw new ConflictError('El pago tiene devoluciones registradas: no puede revertirse totalmente');
    const r = await repo.insertarReversion(pagoId, datos.motivo, actor.usuarioId);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'revertir', entidad: 'pagos', registroId: pagoId, motivo: datos.motivo, resultado: 'ok' });
    return r;
  });
}

type Adjunto = { contenido: Buffer; nombreOriginal: string; tipoMime: string };

/** Devolución sobre una aplicación del pago (no excede lo aplicado menos lo ya devuelto). */
export async function registrarDevolucion(actor: Actor, pagoId: string, datos: DatosDevolucion, evidencia?: Adjunto | null) {
  return transaccion(async () => {
    const p = await repo.bloquearPago(pagoId);
    if (!p) throw new NotFoundError('El pago no existe');
    if (p.revertido) throw new ConflictError('El pago está revertido: no admite devoluciones');
    const a = await repo.bloquearAplicacion(datos.aplicacionId);
    if (!a || a.pago_id !== pagoId) throw new NotFoundError('La aplicación no pertenece a este pago');
    const disponible = aCentimos(a.importe) - aCentimos(a.devuelto);
    if (aCentimos(datos.importe) > disponible) {
      throw new ValidationError(`La devolución excede lo aplicado a la cuota (disponible ${formatoMoneda(deCentimos(disponible))})`);
    }
    let sesionId: string | null = null;
    if (datos.enEfectivo) {
      const s = await caja.sesionAbiertaDeOperador(actor.usuarioId);
      if (!s) throw new ValidationError('Para devolver en efectivo abra primero su sesión de caja');
      sesionId = s.id;
    }
    const archivo = evidencia ? await guardarArchivo(evidencia) : null;
    const r = await repo.insertarDevolucion({
      pagoId,
      aplicacionId: datos.aplicacionId,
      sesionCajaId: sesionId,
      importe: datos.importe,
      motivo: datos.motivo,
      evidenciaId: archivo?.id ?? null,
      autorizadoPor: actor.usuarioId,
    });
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'devolver',
      entidad: 'devoluciones',
      registroId: r.id,
      motivo: `${formatoMoneda(datos.importe)} del pago ${pagoId}: ${datos.motivo}`,
      resultado: 'ok',
    });
    return r;
  });
}

export async function registrarComprobante(actor: Actor, pagoId: string, datos: DatosComprobante, archivo?: Adjunto | null) {
  return transaccion(async () => {
    const p = await repo.bloquearPago(pagoId);
    if (!p) throw new NotFoundError('El pago no existe');
    const adjunto = archivo ? await guardarArchivo(archivo) : null;
    const r = await repo.insertarComprobante(pagoId, datos, adjunto?.id ?? null);
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'registrar_comprobante',
      entidad: 'comprobantes_externos',
      registroId: r.id,
      motivo: `${datos.tipo} ${datos.serie}-${datos.numero} (pago ${pagoId})`,
      resultado: 'ok',
    });
    return r;
  });
}

/** Recibo en PDF de un pago (la autorización la hace quien lo invoca). */
export async function reciboPdf(pagoId: string) {
  const d = await repo.obtenerDetallePago(pagoId);
  if (!d) throw new NotFoundError('El pago no existe');
  if (!d.recibo) throw new NotFoundError('El pago no tiene recibo emitido');
  const contenido = await generarReciboPdf(d);
  return { contenido, nombre: `recibo-${numeroRecibo(d.recibo.serie, d.recibo.numero)}.pdf` };
}

/** Evidencia o comprobante adjunto: solo si pertenece a un pago. */
export async function archivoDePago(archivoId: string) {
  const pagoId = await repo.pagoDeArchivo(archivoId);
  if (!pagoId) throw new NotFoundError('El archivo no existe');
  return leerArchivo(archivoId);
}
