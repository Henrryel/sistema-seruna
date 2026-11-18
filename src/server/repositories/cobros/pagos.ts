import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type {
  AlumnoBusqueda,
  ApoderadoPagante,
  AplicacionDetalle,
  ComprobanteDetalle,
  DatosComprobante,
  DetallePago,
  DevolucionDetalle,
  FilaPago,
  MatriculaResumen,
  MedioBase,
  MedioPago,
} from '@/esquemas/cobros/pagos';
import { medioDesdeBase } from '@/esquemas/cobros/pagos';
import { GRADO_TEXTO, HOY_LIMA, aIso, medioUi, nombreAlumno, seccionActual } from './comunes';

// Repositorio: pagos, aplicaciones, recibos (emitir_recibo_caja), reversiones, devoluciones y comprobantes.

export async function pagoPorClave(clave: string) {
  return db()
    .selectFrom('pagos as p')
    .leftJoin('recibos_caja as r', 'r.pago_id', 'p.id')
    .leftJoin('series_recibos as s', 's.id', 'r.serie_id')
    .select(['p.id', 'r.id as recibo_id', 's.codigo as serie', 'r.numero'])
    .where('p.clave_idempotencia', '=', clave)
    .executeTakeFirst();
}

export async function insertarPago(v: {
  claveIdempotencia: string;
  sesionCajaId: string | null;
  registradoPor: string;
  pagante: { personaId?: string; tipoDocumento: string | null; numeroDocumento: string | null; nombre: string; direccion: string | null };
  importe: string;
  medio: MedioBase;
  referencia: string | null;
}) {
  return db()
    .insertInto('pagos')
    .values({
      clave_idempotencia: v.claveIdempotencia,
      sesion_caja_id: v.sesionCajaId,
      registrado_por: v.registradoPor,
      pagante_persona_id: v.pagante.personaId ?? null,
      pagante_tipo_documento: v.pagante.tipoDocumento,
      pagante_numero_documento: v.pagante.numeroDocumento,
      pagante_nombre: v.pagante.nombre,
      pagante_direccion: v.pagante.direccion,
      importe: v.importe,
      medio: v.medio,
      referencia: v.referencia,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function insertarAplicacion(pagoId: string, cuotaId: string, importe: string, imputacion: 'regla' | 'eleccion_pagante') {
  return db()
    .insertInto('aplicaciones_pago')
    .values({ pago_id: pagoId, cuota_id: cuotaId, importe, imputacion })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Emite (o devuelve) el recibo con el correlativo de la serie: lo hace la función de la base. */
export async function emitirRecibo(pagoId: string, serieId: string, usuarioId: string) {
  const r = await sql<{ id: string; pago_id: string; serie_id: string; numero: string }>`
    select id, pago_id, serie_id, numero from emitir_recibo_caja(${pagoId}::bigint, ${serieId}::bigint, ${usuarioId}::bigint)`.execute(db());
  const recibo = r.rows[0];
  if (!recibo) throw new Error('emitir_recibo_caja no devolvió el recibo');
  const serie = await db().selectFrom('series_recibos').select('codigo').where('id', '=', recibo.serie_id).executeTakeFirstOrThrow();
  return { ...recibo, serie: serie.codigo };
}

export async function cuotasPorIds(cuotaIds: string[]) {
  if (cuotaIds.length === 0) return [];
  return db().selectFrom('cuotas').select(['id', 'matricula_id']).where('id', 'in', cuotaIds).execute();
}

// ---------- Listado y detalle ----------

export interface FiltrosPagos {
  q?: string;
  desde?: string;
  hasta?: string;
  medio?: MedioPago;
  estado?: 'vigente' | 'revertido';
  estudianteId?: string;
  sesionId?: string;
}

export async function listarPagos(filtros: FiltrosPagos, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('pagos as p')
      .leftJoin('recibos_caja as r', 'r.pago_id', 'p.id')
      .leftJoin('series_recibos as sr', 'sr.id', 'r.serie_id')
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('aplicaciones_pago as a')
            .innerJoin('cuotas as c', 'c.id', 'a.cuota_id')
            .select('c.estudiante_id')
            .whereRef('a.pago_id', '=', 'p.id')
            .orderBy('a.id')
            .limit(1)
            .as('al'),
        (j) => j.onTrue(),
      )
      .leftJoin('estudiantes as e', 'e.id', 'al.estudiante_id')
      .leftJoin('personas as pe', 'pe.id', 'e.persona_id')
      .innerJoin('usuarios as u', 'u.id', 'p.registrado_por');
    if (filtros.desde) q = q.where(sql<boolean>`(p.pagado_en at time zone 'America/Lima')::date >= ${filtros.desde}::date`);
    if (filtros.hasta) q = q.where(sql<boolean>`(p.pagado_en at time zone 'America/Lima')::date <= ${filtros.hasta}::date`);
    if (filtros.medio) q = q.where(sql<boolean>`${medioUi('p')} = ${filtros.medio}`);
    if (filtros.estado === 'revertido') q = q.where(sql<boolean>`exists (select 1 from reversiones_pago rv where rv.pago_id = p.id)`);
    if (filtros.estado === 'vigente') q = q.where(sql<boolean>`not exists (select 1 from reversiones_pago rv where rv.pago_id = p.id)`);
    if (filtros.estudianteId) {
      q = q.where(sql<boolean>`exists (select 1 from aplicaciones_pago a join cuotas c on c.id = a.cuota_id where a.pago_id = p.id and c.estudiante_id = ${filtros.estudianteId}::bigint)`);
    }
    if (filtros.sesionId) q = q.where('p.sesion_caja_id', '=', filtros.sesionId);
    if (filtros.q) {
      const t = `%${filtros.q}%`;
      q = q.where(
        sql<boolean>`(coalesce(pe.apellidos || ' ' || pe.nombres, '') || ' ' || coalesce(e.codigo, '') || ' ' || p.pagante_nombre || ' ' || coalesce(p.referencia, '') || ' ' || coalesce(sr.codigo || '-' || lpad(r.numero::text, 8, '0'), '')) ilike ${t}`,
      );
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'p.id',
        'p.pagado_en',
        'p.importe',
        'p.medio',
        medioUi('p').as('medio_ui'),
        'p.referencia',
        'p.pagante_nombre',
        'e.id as estudiante_id',
        sql<string | null>`case when pe.id is null then null else pe.apellidos || ', ' || pe.nombres end`.as('alumno'),
        'e.codigo',
        'r.id as recibo_id',
        'sr.codigo as serie',
        'r.numero',
        sql<boolean>`exists (select 1 from reversiones_pago rv where rv.pago_id = p.id)`.as('revertido'),
        sql<string>`coalesce((select sum(d.importe) from devoluciones d where d.pago_id = p.id), 0)::numeric(12,2)`.as('devuelto'),
        'u.login as registrado_por',
        'p.sesion_caja_id',
      ])
      .orderBy('p.pagado_en', 'desc')
      .orderBy('p.id', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaPago => ({ ...f, pagado_en: aIso(f.pagado_en) ?? '', medio_ui: f.medio_ui as MedioPago })),
    total: Number(total.n),
  };
}

export async function obtenerDetallePago(id: string): Promise<DetallePago | undefined> {
  const p = await db()
    .selectFrom('pagos as p')
    .innerJoin('usuarios as u', 'u.id', 'p.registrado_por')
    .leftJoin('sesiones_caja as sc', 'sc.id', 'p.sesion_caja_id')
    .leftJoin('cajas as cj', 'cj.id', 'sc.caja_id')
    .select([
      'p.id',
      'p.clave_idempotencia',
      'p.pagado_en',
      'p.importe',
      'p.medio',
      'p.referencia',
      'p.pagante_persona_id',
      'p.pagante_tipo_documento',
      'p.pagante_numero_documento',
      'p.pagante_nombre',
      'p.pagante_direccion',
      'u.login as registrado_por',
      'p.sesion_caja_id',
      'cj.nombre as caja',
    ])
    .where('p.id', '=', id)
    .executeTakeFirst();
  if (!p) return undefined;

  const [recibo, reversion, aplicaciones, devoluciones, comprobantes] = await Promise.all([
    db()
      .selectFrom('recibos_caja as r')
      .innerJoin('series_recibos as s', 's.id', 'r.serie_id')
      .innerJoin('usuarios as u', 'u.id', 'r.emitido_por')
      .select(['r.id', 's.codigo as serie', 'r.numero', 'r.emitido_en', 'u.login as emitido_por'])
      .where('r.pago_id', '=', id)
      .executeTakeFirst(),
    db()
      .selectFrom('reversiones_pago as rv')
      .innerJoin('usuarios as u', 'u.id', 'rv.autorizado_por')
      .select(['rv.motivo', 'u.login as autorizado_por', 'rv.revertido_en'])
      .where('rv.pago_id', '=', id)
      .executeTakeFirst(),
    db()
      .selectFrom('aplicaciones_pago as a')
      .innerJoin('cuotas as c', 'c.id', 'a.cuota_id')
      .select([
        'a.id',
        'a.cuota_id',
        'c.concepto',
        'c.numero',
        'c.mes_servicio',
        'c.vence_en',
        'a.importe',
        'a.imputacion',
        sql<string>`coalesce((select sum(d.importe) from devoluciones d where d.aplicacion_id = a.id), 0)::numeric(12,2)`.as('devuelto'),
      ])
      .where('a.pago_id', '=', id)
      .orderBy('c.vence_en')
      .orderBy('a.id')
      .execute(),
    db()
      .selectFrom('devoluciones as d')
      .innerJoin('usuarios as u', 'u.id', 'd.autorizado_por')
      .select(['d.id', 'd.aplicacion_id', 'd.importe', 'd.motivo', 'd.sesion_caja_id', 'd.evidencia_id', 'u.login as autorizado_por', 'd.devuelto_en'])
      .where('d.pago_id', '=', id)
      .orderBy('d.devuelto_en')
      .execute(),
    db()
      .selectFrom('comprobantes_externos as ce')
      .select(['ce.id', 'ce.ruc_emisor', 'ce.tipo', 'ce.serie', 'ce.numero', 'ce.emitido_en', 'ce.estado', 'ce.archivo_id'])
      .where('ce.pago_id', '=', id)
      .orderBy('ce.id')
      .execute(),
  ]);

  const alumno = await db()
    .selectFrom('aplicaciones_pago as a')
    .innerJoin('cuotas as c', 'c.id', 'a.cuota_id')
    .innerJoin('matriculas as m', 'm.id', 'c.matricula_id')
    .innerJoin('anios_academicos as an', 'an.id', 'm.anio_id')
    .innerJoin('grados as g', 'g.id', 'm.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('estudiantes as e', 'e.id', 'c.estudiante_id')
    .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
    .select(['e.id as estudiante_id', nombreAlumno('pe').as('nombre'), 'e.codigo', 'an.anio', GRADO_TEXTO.as('grado'), seccionActual('m').as('seccion')])
    .where('a.pago_id', '=', id)
    .orderBy('a.id')
    .limit(1)
    .executeTakeFirst();

  return {
    id: p.id,
    clave_idempotencia: p.clave_idempotencia,
    pagado_en: aIso(p.pagado_en) ?? '',
    importe: p.importe,
    medio: p.medio,
    medio_ui: medioDesdeBase(p.medio, p.referencia),
    referencia: p.referencia,
    pagante: {
      personaId: p.pagante_persona_id,
      tipoDocumento: p.pagante_tipo_documento,
      numeroDocumento: p.pagante_numero_documento,
      nombre: p.pagante_nombre,
      direccion: p.pagante_direccion,
    },
    registrado_por: p.registrado_por,
    sesion_caja_id: p.sesion_caja_id,
    caja: p.caja,
    alumno: alumno
      ? { estudianteId: alumno.estudiante_id, nombre: alumno.nombre, codigo: alumno.codigo, anio: alumno.anio, grado: alumno.grado, seccion: alumno.seccion }
      : null,
    recibo: recibo ? { id: recibo.id, serie: recibo.serie, numero: recibo.numero, emitido_en: aIso(recibo.emitido_en) ?? '', emitido_por: recibo.emitido_por } : null,
    reversion: reversion ? { motivo: reversion.motivo, autorizado_por: reversion.autorizado_por, revertido_en: aIso(reversion.revertido_en) ?? '' } : null,
    aplicaciones: aplicaciones as AplicacionDetalle[],
    devoluciones: devoluciones.map(
      (d): DevolucionDetalle => ({
        id: d.id,
        aplicacion_id: d.aplicacion_id,
        importe: d.importe,
        motivo: d.motivo,
        en_efectivo: d.sesion_caja_id !== null,
        evidencia_id: d.evidencia_id,
        autorizado_por: d.autorizado_por,
        devuelto_en: aIso(d.devuelto_en) ?? '',
      }),
    ),
    comprobantes: comprobantes as ComprobanteDetalle[],
  };
}

/** Pago bloqueado (FOR UPDATE) con su estado. */
export async function bloquearPago(id: string) {
  return db()
    .selectFrom('pagos as p')
    .select([
      'p.id',
      'p.importe',
      'p.medio',
      sql<boolean>`exists (select 1 from reversiones_pago r where r.pago_id = p.id)`.as('revertido'),
      sql<boolean>`exists (select 1 from devoluciones d where d.pago_id = p.id)`.as('con_devoluciones'),
    ])
    .where('p.id', '=', id)
    .forUpdate()
    .executeTakeFirst();
}

export async function insertarReversion(pagoId: string, motivo: string, autorizadoPor: string) {
  return db()
    .insertInto('reversiones_pago')
    .values({ pago_id: pagoId, motivo, autorizado_por: autorizadoPor })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Aplicación bloqueada (FOR UPDATE) con lo ya devuelto. */
export async function bloquearAplicacion(aplicacionId: string) {
  const a = await db()
    .selectFrom('aplicaciones_pago')
    .select(['id', 'pago_id', 'cuota_id', 'importe'])
    .where('id', '=', aplicacionId)
    .forUpdate()
    .executeTakeFirst();
  if (!a) return undefined;
  const d = await db()
    .selectFrom('devoluciones')
    .select(sql<string>`coalesce(sum(importe), 0)::numeric(12,2)`.as('total'))
    .where('aplicacion_id', '=', aplicacionId)
    .executeTakeFirstOrThrow();
  return { ...a, devuelto: d.total };
}

export async function insertarDevolucion(v: {
  pagoId: string;
  aplicacionId: string;
  sesionCajaId: string | null;
  importe: string;
  motivo: string;
  evidenciaId: string | null;
  autorizadoPor: string;
}) {
  return db()
    .insertInto('devoluciones')
    .values({
      pago_id: v.pagoId,
      aplicacion_id: v.aplicacionId,
      sesion_caja_id: v.sesionCajaId,
      importe: v.importe,
      motivo: v.motivo,
      evidencia_id: v.evidenciaId,
      autorizado_por: v.autorizadoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function insertarComprobante(pagoId: string, d: DatosComprobante, archivoId: string | null) {
  return db()
    .insertInto('comprobantes_externos')
    .values({
      pago_id: pagoId,
      ruc_emisor: d.rucEmisor,
      tipo: d.tipo,
      serie: d.serie,
      numero: d.numero,
      emitido_en: d.emitidoEn,
      estado: d.estado,
      archivo_id: archivoId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Archivo adjunto (evidencia de devolución o comprobante) y el pago al que pertenece. */
export async function pagoDeArchivo(archivoId: string) {
  const dev = await db().selectFrom('devoluciones').select('pago_id').where('evidencia_id', '=', archivoId).executeTakeFirst();
  if (dev) return dev.pago_id;
  const ce = await db().selectFrom('comprobantes_externos').select('pago_id').where('archivo_id', '=', archivoId).executeTakeFirst();
  return ce?.pago_id;
}

export async function pagoDeRecibo(reciboId: string) {
  return db().selectFrom('recibos_caja').select(['id', 'pago_id']).where('id', '=', reciboId).executeTakeFirst();
}

/** Estudiantes a cuyas cuotas se aplicó el pago. */
export async function estudiantesDePago(pagoId: string): Promise<string[]> {
  const filas = await db()
    .selectFrom('aplicaciones_pago as a')
    .innerJoin('cuotas as c', 'c.id', 'a.cuota_id')
    .select('c.estudiante_id')
    .distinct()
    .where('a.pago_id', '=', pagoId)
    .execute();
  return filas.map((f) => f.estudiante_id);
}

// ---------- Búsqueda de alumnos y cuenta ----------

export async function buscarAlumnos(texto: string): Promise<AlumnoBusqueda[]> {
  const t = `%${texto}%`;
  const filas = await db()
    .selectFrom('estudiantes as e')
    .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('matriculas as m')
          .innerJoin('anios_academicos as an', 'an.id', 'm.anio_id')
          .innerJoin('grados as g', 'g.id', 'm.grado_id')
          .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
          .select(['m.id as matricula_id', 'an.anio', GRADO_TEXTO.as('grado'), seccionActual('m').as('seccion'), 'm.estado'])
          .whereRef('m.estudiante_id', '=', 'e.id')
          .where('m.estado', '<>', 'anulada')
          .orderBy(sql`m.estado = 'activa'`, 'desc')
          .orderBy('an.anio', 'desc')
          .limit(1)
          .as('mt'),
      (j) => j.onTrue(),
    )
    .select([
      'e.id as estudiante_id',
      'e.codigo',
      'pe.nombres',
      'pe.apellidos',
      sql<string | null>`(select di.tipo || ' ' || di.numero from documentos_identidad di where di.persona_id = pe.id order by di.id limit 1)`.as('documento'),
      'mt.matricula_id',
      'mt.anio',
      'mt.grado',
      'mt.seccion',
      'mt.estado as estado_matricula',
    ])
    .where((eb) =>
      eb.or([
        eb(sql<string>`pe.apellidos || ' ' || pe.nombres`, 'ilike', t),
        eb(sql<string>`pe.nombres || ' ' || pe.apellidos`, 'ilike', t),
        eb('e.codigo', 'ilike', t),
        eb.exists(eb.selectFrom('documentos_identidad as di').select('di.id').whereRef('di.persona_id', '=', 'pe.id').where('di.numero', 'ilike', t)),
      ]),
    )
    .orderBy('pe.apellidos')
    .orderBy('pe.nombres')
    .limit(20)
    .execute();
  return filas.map((f) => ({ ...f, matricula_id: f.matricula_id ?? null, anio: f.anio ?? null, grado: f.grado ?? null, seccion: f.seccion ?? null, estado_matricula: f.estado_matricula ?? null }));
}

export async function estudianteBasico(estudianteId: string) {
  return db()
    .selectFrom('estudiantes as e')
    .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
    .select(['e.id as estudianteId', 'e.codigo', 'pe.nombres', 'pe.apellidos'])
    .where('e.id', '=', estudianteId)
    .executeTakeFirst();
}

export async function matriculasDeEstudiante(estudianteId: string): Promise<MatriculaResumen[]> {
  return db()
    .selectFrom('matriculas as m')
    .innerJoin('anios_academicos as an', 'an.id', 'm.anio_id')
    .innerJoin('grados as g', 'g.id', 'm.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select(['m.id', 'm.anio_id', 'an.anio', GRADO_TEXTO.as('grado'), seccionActual('m').as('seccion'), 'm.estado'])
    .where('m.estudiante_id', '=', estudianteId)
    .where('m.estado', '<>', 'anulada')
    .orderBy('an.anio', 'desc')
    .execute();
}

export async function apoderadosDeEstudiante(estudianteId: string): Promise<ApoderadoPagante[]> {
  return db()
    .selectFrom('estudiante_apoderado as ea')
    .innerJoin('personas as pe', 'pe.id', 'ea.persona_id')
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('documentos_identidad as di')
          .select(['di.tipo', 'di.numero'])
          .whereRef('di.persona_id', '=', 'pe.id')
          .orderBy(sql`di.tipo = 'DNI'`, 'desc')
          .orderBy('di.id')
          .limit(1)
          .as('doc'),
      (j) => j.onTrue(),
    )
    .select([
      'pe.id as persona_id',
      sql<string>`pe.nombres || ' ' || pe.apellidos`.as('nombre'),
      'ea.parentesco',
      'doc.tipo as tipo_documento',
      'doc.numero as numero_documento',
      'pe.direccion',
    ])
    .where('ea.estudiante_id', '=', estudianteId)
    .where(sql<boolean>`ea.vigencia @> ${HOY_LIMA}`)
    .orderBy('pe.apellidos')
    .execute()
    .then((filas) => filas.map((f) => ({ ...f, tipo_documento: f.tipo_documento ?? null, numero_documento: f.numero_documento ?? null })));
}

/** Pagos aplicados a cuotas de una matrícula (para estados de cuenta). */
export async function pagosDeMatricula(matriculaId: string) {
  const filas = await db()
    .selectFrom('pagos as p')
    .innerJoin('aplicaciones_pago as a', 'a.pago_id', 'p.id')
    .innerJoin('cuotas as c', 'c.id', 'a.cuota_id')
    .leftJoin('recibos_caja as r', 'r.pago_id', 'p.id')
    .leftJoin('series_recibos as sr', 'sr.id', 'r.serie_id')
    .select([
      'p.id',
      'p.pagado_en',
      'p.medio',
      'p.referencia',
      'r.id as recibo_id',
      'sr.codigo as serie',
      'r.numero',
      sql<string>`sum(a.importe)::numeric(12,2)`.as('importe'),
      sql<boolean>`exists (select 1 from reversiones_pago rv where rv.pago_id = p.id)`.as('revertido'),
      sql<string>`coalesce((select sum(d.importe) from devoluciones d where d.pago_id = p.id), 0)::numeric(12,2)`.as('devuelto'),
      sql<string>`string_agg(case c.concepto when 'pension' then 'Pensión ' || to_char(c.mes_servicio, 'MM/YYYY') when 'matricula' then 'Matrícula' else 'Ingreso ' || c.numero end, ', ' order by c.vence_en)`.as('detalle'),
    ])
    .where('c.matricula_id', '=', matriculaId)
    .groupBy(['p.id', 'r.id', 'sr.codigo'])
    .orderBy('p.pagado_en', 'desc')
    .execute();
  return filas.map((f) => ({ ...f, pagado_en: aIso(f.pagado_en) ?? '' }));
}
