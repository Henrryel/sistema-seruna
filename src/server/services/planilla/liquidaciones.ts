import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/planilla/liquidaciones';
import * as repoContratos from '@/server/repositories/planilla/contratos';
import type { Actor } from '@/server/auth/actor';
import {
  conceptoTardanzas,
  type DatosLiquidacion,
  type DatosLinea,
  type DatosPago,
  type DatosPeriodo,
  type DatosReversion,
  type VistaPreviaTardanzas,
} from '@/esquemas/planilla/liquidaciones';
import { generarBoletaPdf } from '@/server/pdf/planilla/boleta';
import { guardarAdjunto, type ArchivoSubido } from './archivos';

// Servicio de liquidaciones docentes. La base es la fuente de verdad:
//  - `validar_liquidacion_docente`: nace en borrador en período abierto, congela condiciones del contrato,
//    prorrateo con importe y motivo, aprobar exige neto ≥ 0 y TODAS las horas del mes resueltas e incluidas.
//  - `validar_detalle_liquidacion`: detalle solo en borrador; líneas 'horas' con horas aprobadas del contrato.
//  - `validar_movimiento_pago_docente`: pagos solo de aprobadas y sin exceder el saldo.
//  - `auditar_planilla`: audita aprobación, pagos y reversiones (no se duplica en bitácora).
// Lo único que calcula la app es el descuento por tardanzas (la base no lo define; discrepancias.md §24).

export const listarPeriodos = repo.listarPeriodos;
export const listarLiquidaciones = repo.listarLiquidaciones;

export async function abrirPeriodo(actor: Actor, d: DatosPeriodo) {
  return transaccion(async () => {
    const r = await repo.crearPeriodo(`${d.mes}-01`, actor.usuarioId);
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'abrir',
      entidad: 'periodos_liquidacion',
      registroId: r.id,
      resultado: 'ok',
    });
    return r;
  });
}

export async function cerrarPeriodo(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.cerrarPeriodo(id, actor.usuarioId);
    if (!r) throw new NotFoundError('El período no existe');
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'cerrar',
      entidad: 'periodos_liquidacion',
      registroId: id,
      resultado: 'ok',
    });
    return r;
  });
}

export async function obtenerDetalle(id: string) {
  const d = await repo.detalleLiquidacion(id);
  if (!d) throw new NotFoundError('La liquidación no existe');
  return d;
}

/** Boleta PDF (en borrador se marca como no válida para pago). */
export async function boleta(id: string) {
  const d = await obtenerDetalle(id);
  return {
    contenido: await generarBoletaPdf(d),
    nombre: `boleta-${d.mes.slice(0, 7)}-${d.codigo_docente}${d.estado === 'borrador' ? '-borrador' : ''}.pdf`,
  };
}

export async function crearLiquidacion(actor: Actor, d: DatosLiquidacion) {
  return transaccion(async () => {
    const contrato = await repoContratos.obtenerContrato(d.contratoId);
    if (!contrato) throw new NotFoundError('El contrato no existe');
    const porHoras = contrato.modalidad === 'por_horas';
    const r = await repo.crearLiquidacion({
      contratoId: d.contratoId,
      periodoId: d.periodoId,
      modalidad: contrato.modalidad,
      // El prorrateo solo existe en contratos fijos (la base congela la modalidad del contrato).
      importeFijo: porHoras ? null : d.importeFijo,
      motivoProrrateo: porHoras ? null : d.motivoProrrateo,
      registradoPor: actor.usuarioId,
    });
    const horas = porHoras ? await repo.incluirHorasAprobadas(r.id, actor.usuarioId) : 0;
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'crear',
      entidad: 'liquidaciones_docentes',
      registroId: r.id,
      motivo: porHoras ? null : d.motivoProrrateo,
      resultado: 'borrador',
    });
    return { id: r.id, horasIncluidas: horas };
  });
}

async function exigirLiquidacion(id: string) {
  const l = await repo.obtenerLiquidacion(id);
  if (!l) throw new NotFoundError('La liquidación no existe');
  return l;
}

/** Incluye todas las horas aprobadas del mes aún no liquidadas (contratos por horas). */
export async function incluirHoras(actor: Actor, id: string) {
  return transaccion(async () => {
    const l = await exigirLiquidacion(id);
    if (l.modalidad !== 'por_horas')
      throw new ValidationError('Solo las liquidaciones por horas incluyen horas trabajadas');
    const n = await repo.incluirHorasAprobadas(id, actor.usuarioId);
    if (n > 0) {
      await registrarBitacora({
        actorId: actor.usuarioId,
        accion: 'incluir_horas',
        entidad: 'liquidaciones_docentes',
        registroId: id,
        motivo: `${n} registro(s)`,
        resultado: 'ok',
      });
    }
    return { horasIncluidas: n };
  });
}

export async function agregarLinea(actor: Actor, id: string, d: DatosLinea) {
  return transaccion(async () => {
    await exigirLiquidacion(id);
    const r = await repo.agregarLinea({
      liquidacionId: id,
      tipo: d.tipo,
      concepto: d.concepto,
      importe: d.importe,
      registradoPor: actor.usuarioId,
    });
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: `agregar_${d.tipo}`,
      entidad: 'detalle_liquidacion_docente',
      registroId: r.id,
      motivo: d.concepto,
      resultado: 'ok',
    });
    return r;
  });
}

export async function eliminarLinea(actor: Actor, id: string, detalleId: string) {
  return transaccion(async () => {
    const linea = await repo.obtenerLinea(detalleId);
    if (!linea || linea.liquidacion_id !== id)
      throw new NotFoundError('La línea no existe en esta liquidación');
    await repo.eliminarLinea(detalleId);
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'quitar_linea',
      entidad: 'detalle_liquidacion_docente',
      registroId: detalleId,
      motivo: linea.concepto,
      resultado: 'ok',
    });
    return { id: detalleId };
  });
}

/** Elimina un borrador (para rehacerlo, p. ej. con otro importe de prorrateo). La base protege las aprobadas. */
export async function eliminarBorrador(actor: Actor, id: string) {
  return transaccion(async () => {
    await exigirLiquidacion(id);
    const r = await repo.eliminarLiquidacion(id);
    if (!r) throw new NotFoundError('La liquidación no existe');
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'eliminar',
      entidad: 'liquidaciones_docentes',
      registroId: id,
      resultado: 'ok',
    });
    return r;
  });
}

export async function vistaPreviaTardanzas(id: string): Promise<VistaPreviaTardanzas> {
  await exigirLiquidacion(id);
  const [dias, resumen, yaRegistrado] = await Promise.all([
    repo.diasTardanza(id),
    repo.resumenTardanzas(id),
    repo.existeLineaTardanzas(id),
  ]);
  if (!resumen) throw new NotFoundError('La liquidación no existe');
  return {
    dias,
    minutos: resumen.minutos,
    minutos_base: resumen.minutos_base,
    monto_base: resumen.monto_base,
    valor_minuto: resumen.valor_minuto,
    importe: resumen.importe,
    concepto: conceptoTardanzas(resumen.minutos),
    ya_registrado: yaRegistrado,
  };
}

/** Registra el descuento por tardanzas como línea 'descuento' con concepto "Tardanzas (N min)". */
export async function registrarTardanzas(actor: Actor, id: string) {
  return transaccion(async () => {
    const previa = await vistaPreviaTardanzas(id);
    if (previa.ya_registrado)
      throw new ConflictError(
        'El descuento por tardanzas ya está registrado; quite esa línea para recalcularlo',
      );
    if (previa.valor_minuto === null)
      throw new ValidationError(
        'El docente no tiene jornadas programadas en el mes para calcular el valor por minuto',
      );
    if (Number(previa.importe) <= 0)
      throw new ValidationError('No hay tardanzas con descuento en el período de la liquidación');
    const r = await repo.agregarLinea({
      liquidacionId: id,
      tipo: 'descuento',
      concepto: previa.concepto,
      importe: previa.importe,
      registradoPor: actor.usuarioId,
    });
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'descontar_tardanzas',
      entidad: 'detalle_liquidacion_docente',
      registroId: r.id,
      motivo: previa.concepto,
      resultado: 'ok',
    });
    return { id: r.id, concepto: previa.concepto, importe: previa.importe, minutos: previa.minutos };
  });
}

/** Aprueba la liquidación: la base verifica neto, horas pendientes/no incluidas y período abierto. */
export async function aprobar(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.aprobarLiquidacion(id, actor.usuarioId);
    if (!r) throw new NotFoundError('La liquidación no existe');
    return r;
  });
}

/** Pago idempotente por `claveIdempotencia` (UUID del cliente): reintentos devuelven el mismo pago. */
export async function registrarPago(
  actor: Actor,
  id: string,
  d: DatosPago,
  evidencia?: ArchivoSubido | null,
) {
  return transaccion(async () => {
    const previo = await repo.obtenerPagoPorClave(d.claveIdempotencia);
    if (previo) {
      if (previo.liquidacion_id !== id)
        throw new ConflictError('La clave del pago ya se usó en otra liquidación');
      return { id: previo.id, repetido: true };
    }
    const evidenciaId = await guardarAdjunto(evidencia);
    const r = await repo.crearPago({
      liquidacionId: id,
      claveIdempotencia: d.claveIdempotencia,
      importe: d.importe,
      medio: d.medio,
      referencia: d.referencia,
      evidenciaId,
      registradoPor: actor.usuarioId,
    });
    return { id: r.id, repetido: false };
  });
}

/** Revierte un pago con motivo (y evidencia opcional). La base impide revertirlo dos veces. */
export async function revertirPago(
  actor: Actor,
  pagoId: string,
  d: DatosReversion,
  evidencia?: ArchivoSubido | null,
) {
  return transaccion(async () => {
    const pago = await repo.obtenerPago(pagoId);
    if (!pago) throw new NotFoundError('El pago no existe');
    const evidenciaId = await guardarAdjunto(evidencia);
    const r = await repo.crearReversion({
      pagoId,
      motivo: d.motivo,
      evidenciaId,
      autorizadoPor: actor.usuarioId,
    });
    return { id: r.id, liquidacionId: pago.liquidacion_id };
  });
}
