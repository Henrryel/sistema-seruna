import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import { leerRangoFechas } from '@/lib/formato';
import type { Modalidad } from '@/esquemas/planilla/contratos';
import {
  PREFIJO_TARDANZAS,
  type DetalleLiquidacion,
  type DiaTardanza,
  type EstadoLiquidacion,
  type FilaLiquidacion,
  type FilaPeriodo,
  type LineaLiquidacion,
  type MedioPago,
  type PagoLiquidacion,
  type TipoLinea,
} from '@/esquemas/planilla/liquidaciones';
import { iso, isoRequerido, patron } from './comun';

// Repositorio: ÚNICO lugar con SQL para períodos, liquidaciones, detalle, pagos y reversiones docentes.
// Totales y saldos SIEMPRE desde las vistas `totales_liquidacion_docente` / `saldos_liquidacion_docente`.

const NOMBRE_PERSONA = sql<string>`p.apellidos || ', ' || p.nombres`;

// ───────────── Períodos ─────────────

export async function listarPeriodos(): Promise<FilaPeriodo[]> {
  const filas = await db()
    .selectFrom('periodos_liquidacion as pe')
    .select((eb) => [
      'pe.id',
      'pe.mes',
      'pe.estado',
      'pe.creado_en',
      'pe.cerrado_en',
      eb
        .selectFrom('liquidaciones_docentes as l')
        .select((e) => e.fn.countAll<string>().as('n'))
        .whereRef('l.periodo_id', '=', 'pe.id')
        .where('l.estado', '=', 'borrador')
        .as('borradores'),
      eb
        .selectFrom('liquidaciones_docentes as l')
        .select((e) => e.fn.countAll<string>().as('n'))
        .whereRef('l.periodo_id', '=', 'pe.id')
        .where('l.estado', '=', 'aprobada')
        .as('aprobadas'),
      eb
        .selectFrom('horas_docentes as h')
        .select((e) => e.fn.countAll<string>().as('n'))
        .where(sql<boolean>`h.fecha >= pe.mes and h.fecha < (pe.mes + interval '1 month')::date`)
        .where('h.estado', '=', 'pendiente')
        .as('horas_pendientes'),
      eb
        .selectFrom('horas_docentes as h')
        .select((e) => e.fn.countAll<string>().as('n'))
        .where(sql<boolean>`h.fecha >= pe.mes and h.fecha < (pe.mes + interval '1 month')::date`)
        .where('h.estado', '=', 'aprobada')
        .where((e) =>
          e.not(
            e.exists(
              e
                .selectFrom('detalle_liquidacion_docente as d')
                .select('d.id')
                .whereRef('d.hora_docente_id', '=', 'h.id'),
            ),
          ),
        )
        .as('horas_sin_liquidar'),
    ])
    .orderBy('pe.mes', 'desc')
    .limit(240)
    .execute();
  return filas.map((f) => ({
    id: f.id,
    mes: f.mes,
    estado: f.estado as FilaPeriodo['estado'],
    creado_en: isoRequerido(f.creado_en),
    cerrado_en: iso(f.cerrado_en),
    borradores: Number(f.borradores ?? 0),
    aprobadas: Number(f.aprobadas ?? 0),
    horas_pendientes: Number(f.horas_pendientes ?? 0),
    horas_sin_liquidar: Number(f.horas_sin_liquidar ?? 0),
  }));
}

export async function obtenerPeriodo(id: string) {
  return db().selectFrom('periodos_liquidacion').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function crearPeriodo(mes: string, registradoPor: string) {
  return db()
    .insertInto('periodos_liquidacion')
    .values({ mes, registrado_por: registradoPor })
    .returning(['id', 'mes'])
    .executeTakeFirstOrThrow();
}

/** Cierra el período. La base exige que no queden borradores ni horas pendientes o sin liquidar. */
export async function cerrarPeriodo(id: string, cerradoPor: string) {
  return db()
    .updateTable('periodos_liquidacion')
    .set({ estado: 'cerrado', cerrado_por: cerradoPor, cerrado_en: sql`now()` })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

// ───────────── Liquidaciones ─────────────

export interface FiltrosLiquidaciones {
  q?: string;
  periodoId?: string;
  estado?: EstadoLiquidacion;
  docenteId?: string;
}

function baseLiquidaciones(filtros: FiltrosLiquidaciones) {
  let q = db()
    .selectFrom('liquidaciones_docentes as l')
    .innerJoin('periodos_liquidacion as pe', 'pe.id', 'l.periodo_id')
    .innerJoin('contratos_docentes as c', 'c.id', 'l.contrato_id')
    .innerJoin('docentes as d', 'd.id', 'c.docente_id')
    .innerJoin('personas as p', 'p.id', 'd.persona_id');
  if (filtros.periodoId) q = q.where('l.periodo_id', '=', filtros.periodoId);
  if (filtros.estado) q = q.where('l.estado', '=', filtros.estado);
  if (filtros.docenteId) q = q.where('c.docente_id', '=', filtros.docenteId);
  if (filtros.q) {
    const t = patron(filtros.q);
    q = q.where((eb) =>
      eb.or([eb('c.referencia', 'ilike', t), eb('d.codigo', 'ilike', t), eb(NOMBRE_PERSONA, 'ilike', t)]),
    );
  }
  return q;
}

export async function listarLiquidaciones(filtros: FiltrosLiquidaciones, p: Paginacion | null) {
  const total = await baseLiquidaciones(filtros)
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    baseLiquidaciones(filtros)
      .innerJoin('saldos_liquidacion_docente as s', 's.liquidacion_id', 'l.id')
      .select([
        'l.id',
        'l.periodo_id',
        'pe.mes',
        'pe.estado as periodo_estado',
        'l.contrato_id',
        'c.referencia',
        'c.docente_id',
        NOMBRE_PERSONA.as('docente'),
        'd.codigo as codigo_docente',
        'l.modalidad',
        'l.estado',
        's.minutos_aprobados',
        's.base',
        's.adicionales',
        's.descuentos',
        's.neto',
        's.abonado',
        's.saldo',
      ])
      .orderBy('pe.mes', 'desc')
      .orderBy('p.apellidos')
      .orderBy('p.nombres'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaLiquidacion => ({
      id: f.id,
      periodo_id: f.periodo_id,
      mes: f.mes,
      periodo_estado: f.periodo_estado,
      contrato_id: f.contrato_id,
      referencia: f.referencia,
      docente_id: f.docente_id,
      docente: f.docente,
      codigo_docente: f.codigo_docente,
      modalidad: f.modalidad as Modalidad,
      estado: f.estado as EstadoLiquidacion,
      minutos_aprobados: Number(f.minutos_aprobados ?? 0),
      base: f.base ?? '0',
      adicionales: f.adicionales ?? '0',
      descuentos: f.descuentos ?? '0',
      neto: f.neto ?? '0',
      abonado: f.abonado ?? '0',
      saldo: f.saldo,
    })),
    total: Number(total.n),
  };
}

/** Cabecera mínima (para autorizar y orquestar). */
export async function obtenerLiquidacion(id: string) {
  return db()
    .selectFrom('liquidaciones_docentes as l')
    .innerJoin('contratos_docentes as c', 'c.id', 'l.contrato_id')
    .select(['l.id', 'l.estado', 'l.modalidad', 'l.contrato_id', 'l.periodo_id', 'c.docente_id'])
    .where('l.id', '=', id)
    .executeTakeFirst();
}

export async function detalleLiquidacion(id: string): Promise<DetalleLiquidacion | null> {
  const c = await db()
    .selectFrom('liquidaciones_docentes as l')
    .innerJoin('periodos_liquidacion as pe', 'pe.id', 'l.periodo_id')
    .innerJoin('contratos_docentes as c', 'c.id', 'l.contrato_id')
    .innerJoin('docentes as d', 'd.id', 'c.docente_id')
    .innerJoin('personas as p', 'p.id', 'd.persona_id')
    .innerJoin('saldos_liquidacion_docente as s', 's.liquidacion_id', 'l.id')
    .select((eb) => [
      'l.id',
      'l.estado',
      'l.periodo_id',
      'pe.mes',
      'pe.estado as periodo_estado',
      'l.contrato_id',
      'c.referencia',
      'c.docente_id',
      NOMBRE_PERSONA.as('docente'),
      'd.codigo as codigo_docente',
      eb
        .selectFrom('documentos_identidad as di')
        .select('di.numero')
        .whereRef('di.persona_id', '=', 'p.id')
        .where('di.tipo', '=', 'DNI')
        .limit(1)
        .as('dni'),
      'l.modalidad',
      'l.sueldo_mensual',
      'l.tarifa_hora',
      'l.minutos_por_hora',
      'l.vigencia_aplicada',
      'l.importe_fijo',
      'l.motivo_prorrateo',
      'l.registrado_en',
      'l.aprobado_en',
      's.minutos_aprobados',
      's.base',
      's.adicionales',
      's.descuentos',
      's.neto',
      's.abonado',
      's.saldo',
      eb
        .selectFrom('horas_docentes as h')
        .select((e) => e.fn.countAll<string>().as('n'))
        .whereRef('h.contrato_id', '=', 'l.contrato_id')
        .where(sql<boolean>`h.fecha >= pe.mes and h.fecha < (pe.mes + interval '1 month')::date`)
        .where('h.estado', '=', 'pendiente')
        .as('horas_pendientes'),
      eb
        .selectFrom('horas_docentes as h')
        .select((e) => e.fn.countAll<string>().as('n'))
        .whereRef('h.contrato_id', '=', 'l.contrato_id')
        .where(sql<boolean>`h.fecha >= pe.mes and h.fecha < (pe.mes + interval '1 month')::date`)
        .where('h.estado', '=', 'aprobada')
        .where((e) =>
          e.not(
            e.exists(
              e
                .selectFrom('detalle_liquidacion_docente as d2')
                .select('d2.id')
                .whereRef('d2.hora_docente_id', '=', 'h.id'),
            ),
          ),
        )
        .as('horas_por_incluir'),
    ])
    .where('l.id', '=', id)
    .executeTakeFirst();
  if (!c) return null;

  const lineas = await db()
    .selectFrom('detalle_liquidacion_docente as dl')
    .leftJoin('horas_docentes as h', 'h.id', 'dl.hora_docente_id')
    .select([
      'dl.id',
      'dl.tipo',
      'dl.concepto',
      'dl.importe',
      'dl.hora_docente_id',
      'h.fecha',
      'h.hora_inicio',
      'h.hora_fin',
      'h.minutos',
      'dl.registrado_en',
    ])
    .where('dl.liquidacion_id', '=', id)
    .orderBy(sql`case dl.tipo when 'horas' then 0 when 'adicional' then 1 else 2 end`)
    .orderBy('h.fecha')
    .orderBy('h.hora_inicio')
    .orderBy('dl.id')
    .execute();

  const pagos = await db()
    .selectFrom('pagos_docentes as pg')
    .leftJoin('reversiones_pago_docente as r', 'r.pago_id', 'pg.id')
    .select([
      'pg.id',
      'pg.importe',
      'pg.medio',
      'pg.referencia',
      'pg.evidencia_id',
      'pg.pagado_en',
      'r.id as reversion_id',
      'r.revertido_en',
      'r.motivo as motivo_reversion',
      'r.evidencia_id as evidencia_reversion_id',
    ])
    .where('pg.liquidacion_id', '=', id)
    .orderBy('pg.pagado_en')
    .execute();

  const vigencia = leerRangoFechas(c.vigencia_aplicada);
  return {
    id: c.id,
    estado: c.estado as EstadoLiquidacion,
    periodo_id: c.periodo_id,
    mes: c.mes,
    periodo_estado: c.periodo_estado,
    contrato_id: c.contrato_id,
    referencia: c.referencia,
    docente_id: c.docente_id,
    docente: c.docente,
    codigo_docente: c.codigo_docente,
    dni: c.dni ?? null,
    modalidad: c.modalidad as Modalidad,
    sueldo_mensual: c.sueldo_mensual,
    tarifa_hora: c.tarifa_hora,
    minutos_por_hora: c.minutos_por_hora,
    vigencia_inicio: vigencia.inicio,
    vigencia_fin: vigencia.fin,
    importe_fijo: c.importe_fijo,
    motivo_prorrateo: c.motivo_prorrateo,
    registrado_en: isoRequerido(c.registrado_en),
    aprobado_en: iso(c.aprobado_en),
    totales: {
      minutos_aprobados: Number(c.minutos_aprobados ?? 0),
      base: c.base ?? '0',
      adicionales: c.adicionales ?? '0',
      descuentos: c.descuentos ?? '0',
      neto: c.neto ?? '0',
      abonado: c.abonado ?? '0',
      saldo: c.saldo,
    },
    lineas: lineas.map((l): LineaLiquidacion => ({
      id: l.id,
      tipo: l.tipo as LineaLiquidacion['tipo'],
      concepto: l.concepto,
      importe: l.importe,
      hora_docente_id: l.hora_docente_id,
      fecha: l.fecha ?? null,
      hora_inicio: l.hora_inicio ? l.hora_inicio.slice(0, 5) : null,
      hora_fin: l.hora_fin ? l.hora_fin.slice(0, 5) : null,
      minutos: l.minutos === null || l.minutos === undefined ? null : Number(l.minutos),
      registrado_en: isoRequerido(l.registrado_en),
    })),
    pagos: pagos.map((pg): PagoLiquidacion => ({
      id: pg.id,
      importe: pg.importe,
      medio: pg.medio as MedioPago,
      referencia: pg.referencia,
      evidencia_id: pg.evidencia_id,
      pagado_en: isoRequerido(pg.pagado_en),
      reversion_id: pg.reversion_id ?? null,
      revertido_en: iso(pg.revertido_en),
      motivo_reversion: pg.motivo_reversion ?? null,
      evidencia_reversion_id: pg.evidencia_reversion_id ?? null,
    })),
    horas_pendientes: Number(c.horas_pendientes ?? 0),
    horas_por_incluir: Number(c.horas_por_incluir ?? 0),
  };
}

/**
 * Crea la liquidación en borrador. El trigger `validar_liquidacion_docente` CONGELA modalidad, tarifas y
 * sueldo del contrato y calcula `vigencia_aplicada` (mes ∩ contrato): los valores enviados aquí para esas
 * columnas son solo de relleno (NOT NULL) y la base los reemplaza.
 */
export async function crearLiquidacion(d: {
  contratoId: string;
  periodoId: string;
  modalidad: string;
  importeFijo: string | null;
  motivoProrrateo: string | null;
  registradoPor: string;
}) {
  return db()
    .insertInto('liquidaciones_docentes')
    .values({
      contrato_id: d.contratoId,
      periodo_id: d.periodoId,
      modalidad: d.modalidad,
      vigencia_aplicada: sql<string>`'empty'::daterange`,
      importe_fijo: d.importeFijo,
      motivo_prorrateo: d.motivoProrrateo,
      registrado_por: d.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Inserta como líneas 'horas' TODAS las horas aprobadas del contrato en la vigencia aplicada aún no liquidadas. */
export async function incluirHorasAprobadas(liquidacionId: string, registradoPor: string): Promise<number> {
  const filas = await db()
    .insertInto('detalle_liquidacion_docente')
    .columns(['liquidacion_id', 'hora_docente_id', 'tipo', 'concepto', 'registrado_por'])
    .expression((eb) =>
      eb
        .selectFrom('liquidaciones_docentes as l')
        .innerJoin('horas_docentes as h', 'h.contrato_id', 'l.contrato_id')
        .select([
          'l.id as liquidacion_id',
          'h.id as hora_docente_id',
          sql<string>`'horas'`.as('tipo'),
          sql<string>`'Horas ' || to_char(h.fecha, 'DD/MM/YYYY') || ' ' || to_char(h.hora_inicio, 'HH24:MI') || '–' || to_char(h.hora_fin, 'HH24:MI')`.as(
            'concepto',
          ),
          sql<string>`${registradoPor}::bigint`.as('registrado_por'),
        ])
        .where('l.id', '=', liquidacionId)
        .where('h.estado', '=', 'aprobada')
        .where(sql<boolean>`l.vigencia_aplicada @> h.fecha`)
        .where((e) =>
          e.not(
            e.exists(
              e
                .selectFrom('detalle_liquidacion_docente as d')
                .select('d.id')
                .whereRef('d.hora_docente_id', '=', 'h.id'),
            ),
          ),
        ),
    )
    .returning(['id'])
    .execute();
  return filas.length;
}

export async function agregarLinea(d: {
  liquidacionId: string;
  tipo: TipoLinea;
  concepto: string;
  importe: string;
  registradoPor: string;
}) {
  return db()
    .insertInto('detalle_liquidacion_docente')
    .values({
      liquidacion_id: d.liquidacionId,
      tipo: d.tipo,
      concepto: d.concepto,
      importe: d.importe,
      registrado_por: d.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function obtenerLinea(id: string) {
  return db()
    .selectFrom('detalle_liquidacion_docente')
    .select(['id', 'liquidacion_id', 'tipo', 'concepto'])
    .where('id', '=', id)
    .executeTakeFirst();
}

/** Quita una línea (la base solo lo permite mientras la liquidación está en borrador). */
export async function eliminarLinea(id: string) {
  return db()
    .deleteFrom('detalle_liquidacion_docente')
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

/** Elimina un borrador con su detalle (la base impide borrar liquidaciones aprobadas o su detalle). */
export async function eliminarLiquidacion(id: string) {
  await db().deleteFrom('detalle_liquidacion_docente').where('liquidacion_id', '=', id).execute();
  return db().deleteFrom('liquidaciones_docentes').where('id', '=', id).returning(['id']).executeTakeFirst();
}

/** Aprueba (borrador → aprobada). La base verifica neto, horas y período, y audita la aprobación. */
export async function aprobarLiquidacion(id: string, aprobadoPor: string) {
  return db()
    .updateTable('liquidaciones_docentes')
    .set({ estado: 'aprobada', aprobado_por: aprobadoPor, aprobado_en: sql`now()` })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

// ───────────── Descuento por tardanzas (regla de la app: discrepancias.md punto 24) ─────────────

/** Minutos de tardanza por día = entrada − (inicio de jornada + tolerancia), en hora de Lima, redondeado hacia arriba. */
const MINUTOS_TARDE = sql<number>`greatest(0, ceil(extract(epoch from ((a.entrada at time zone 'America/Lima') - (a.fecha + j.entrada + make_interval(mins => pol.tolerancia_minutos)))) / 60))::int`;

export async function diasTardanza(liquidacionId: string): Promise<DiaTardanza[]> {
  const filas = await db()
    .selectFrom('liquidaciones_docentes as l')
    .innerJoin('contratos_docentes as c', 'c.id', 'l.contrato_id')
    .innerJoin('asistencia_diaria_docentes as a', (j) => j.onRef('a.docente_id', '=', 'c.docente_id'))
    .innerJoin('jornadas_docente as j', 'j.id', 'a.jornada_id')
    .innerJoin('politicas_asistencia as pol', 'pol.id', 'j.politica_id')
    .select([
      'a.fecha',
      'j.entrada as inicio_jornada',
      'pol.tolerancia_minutos',
      'a.entrada',
      sql<number | null>`case when a.entrada is null then null else ${MINUTOS_TARDE} end`.as('minutos'),
    ])
    .where('l.id', '=', liquidacionId)
    .where('a.estado', '=', 'tarde')
    .where(sql<boolean>`l.vigencia_aplicada @> a.fecha`)
    .orderBy('a.fecha')
    .execute();
  return filas.map((f) => ({
    fecha: f.fecha as string,
    inicio_jornada: f.inicio_jornada.slice(0, 5),
    tolerancia_minutos: f.tolerancia_minutos,
    entrada: iso(f.entrada),
    minutos: f.minutos === null ? null : Number(f.minutos),
  }));
}

/**
 * Resumen del descuento por tardanzas con aritmética NUMERIC en la base (sin flotantes):
 *  fijo      → importe = minutos × sueldo_mensual / minutos programados de jornadas del mes
 *  por horas → importe = minutos × tarifa_hora / minutos_por_hora
 * Usa las condiciones CONGELADAS en la liquidación.
 */
export async function resumenTardanzas(liquidacionId: string) {
  const r = await sql<{
    modalidad: string;
    minutos: number;
    minutos_base: number | null;
    monto_base: string | null;
    valor_minuto: string | null;
    importe: string;
  }>`
    with liq as (
      select l.id, l.modalidad, l.sueldo_mensual, l.tarifa_hora, l.minutos_por_hora, l.vigencia_aplicada, pe.mes, c.docente_id
      from liquidaciones_docentes l
      join periodos_liquidacion pe on pe.id = l.periodo_id
      join contratos_docentes c on c.id = l.contrato_id
      where l.id = ${liquidacionId}
    ), tard as (
      select coalesce(sum(${MINUTOS_TARDE}), 0)::int as minutos
      from liq
      join asistencia_diaria_docentes a on a.docente_id = liq.docente_id and liq.vigencia_aplicada @> a.fecha
      join jornadas_docente j on j.id = a.jornada_id
      join politicas_asistencia pol on pol.id = j.politica_id
      where a.estado = 'tarde' and a.entrada is not null
    ), prog as (
      select coalesce(sum(extract(epoch from (j.salida - j.entrada)) / 60), 0)::int as minutos
      from liq
      join jornadas_docente j on j.docente_id = liq.docente_id
      where j.estado = 'programada' and j.fecha >= liq.mes and j.fecha < (liq.mes + interval '1 month')::date
    )
    select liq.modalidad,
           tard.minutos,
           case when liq.modalidad = 'fijo' then prog.minutos else liq.minutos_por_hora::int end as minutos_base,
           case when liq.modalidad = 'fijo' then liq.sueldo_mensual else liq.tarifa_hora end::text as monto_base,
           case when liq.modalidad = 'fijo'
                then case when prog.minutos > 0 then round(liq.sueldo_mensual / prog.minutos, 6) end
                else round(liq.tarifa_hora / liq.minutos_por_hora, 6) end::text as valor_minuto,
           case when liq.modalidad = 'fijo'
                then case when prog.minutos > 0 then round(tard.minutos * liq.sueldo_mensual / prog.minutos, 2) else 0 end
                else round(tard.minutos * liq.tarifa_hora / liq.minutos_por_hora, 2) end::text as importe
    from liq cross join tard cross join prog
  `.execute(db());
  const fila = r.rows[0];
  if (!fila) return null;
  return {
    modalidad: fila.modalidad as Modalidad,
    minutos: Number(fila.minutos),
    minutos_base: fila.minutos_base === null ? 0 : Number(fila.minutos_base),
    monto_base: fila.monto_base,
    valor_minuto: fila.valor_minuto,
    importe: fila.importe,
  };
}

export async function existeLineaTardanzas(liquidacionId: string) {
  const fila = await db()
    .selectFrom('detalle_liquidacion_docente')
    .select('id')
    .where('liquidacion_id', '=', liquidacionId)
    .where('tipo', '=', 'descuento')
    .where('concepto', 'like', `${PREFIJO_TARDANZAS}%`)
    .executeTakeFirst();
  return Boolean(fila);
}

// ───────────── Pagos y reversiones ─────────────

export async function obtenerPagoPorClave(clave: string) {
  return db()
    .selectFrom('pagos_docentes')
    .select(['id', 'liquidacion_id', 'importe', 'pagado_en'])
    .where('clave_idempotencia', '=', clave)
    .executeTakeFirst();
}

export async function obtenerPago(id: string) {
  return db()
    .selectFrom('pagos_docentes as pg')
    .innerJoin('liquidaciones_docentes as l', 'l.id', 'pg.liquidacion_id')
    .leftJoin('reversiones_pago_docente as r', 'r.pago_id', 'pg.id')
    .select(['pg.id', 'pg.liquidacion_id', 'pg.importe', 'r.id as reversion_id'])
    .where('pg.id', '=', id)
    .executeTakeFirst();
}

/** Registra un pago. La base exige liquidación aprobada, que no exceda el saldo y lo audita. */
export async function crearPago(d: {
  liquidacionId: string;
  claveIdempotencia: string;
  importe: string;
  medio: MedioPago;
  referencia: string | null;
  evidenciaId: string | null;
  registradoPor: string;
}) {
  return db()
    .insertInto('pagos_docentes')
    .values({
      liquidacion_id: d.liquidacionId,
      clave_idempotencia: d.claveIdempotencia,
      importe: d.importe,
      medio: d.medio,
      referencia: d.referencia,
      evidencia_id: d.evidenciaId,
      registrado_por: d.registradoPor,
    })
    .returning(['id', 'pagado_en'])
    .executeTakeFirstOrThrow();
}

/** Revierte un pago (una vez). La base valida y audita. */
export async function crearReversion(d: {
  pagoId: string;
  motivo: string;
  evidenciaId: string | null;
  autorizadoPor: string;
}) {
  return db()
    .insertInto('reversiones_pago_docente')
    .values({
      pago_id: d.pagoId,
      motivo: d.motivo,
      evidencia_id: d.evidenciaId,
      autorizado_por: d.autorizadoPor,
    })
    .returning(['id', 'revertido_en'])
    .executeTakeFirstOrThrow();
}
