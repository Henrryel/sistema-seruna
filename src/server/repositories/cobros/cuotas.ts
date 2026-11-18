import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { EstadoCuota, FilaAjuste, FilaCuota } from '@/esquemas/cobros/cuotas';
import type { CuotaConSaldo } from '@/esquemas/cobros/pagos';
import { GRADO_TEXTO, HOY_LIMA, aIso, nombreAlumno, ordenConcepto, seccionActual, seccionActualId } from './comunes';

// Repositorio: cuotas (con saldo de la vista saldos_cuotas), emisión y ajustes.

/** Semáforo con la misma fórmula que `estadoPago` del cliente. */
function condicionEstado(estado: EstadoCuota) {
  switch (estado) {
    case 'pagado':
      return sql<boolean>`s.saldo <= 0`;
    case 'vencido':
      return sql<boolean>`s.saldo > 0 and c.vence_en < ${HOY_LIMA}`;
    case 'parcial':
      return sql<boolean>`s.saldo > 0 and c.vence_en >= ${HOY_LIMA} and s.abonado > 0`;
    default:
      return sql<boolean>`s.saldo > 0 and c.vence_en >= ${HOY_LIMA} and s.abonado <= 0`;
  }
}

export interface FiltrosCuotas {
  q?: string;
  anioId?: string;
  gradoId?: string;
  seccionId?: string;
  matriculaId?: string;
  concepto?: string;
  estado?: EstadoCuota;
}

export async function listarCuotas(filtros: FiltrosCuotas, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('cuotas as c')
      .innerJoin('saldos_cuotas as s', 's.cuota_id', 'c.id')
      .innerJoin('matriculas as m', 'm.id', 'c.matricula_id')
      .innerJoin('estudiantes as e', 'e.id', 'c.estudiante_id')
      .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
      .innerJoin('anios_academicos as a', 'a.id', 'c.anio_id')
      .innerJoin('grados as g', 'g.id', 'c.grado_id')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id');
    if (filtros.anioId) q = q.where('c.anio_id', '=', filtros.anioId);
    if (filtros.gradoId) q = q.where('c.grado_id', '=', filtros.gradoId);
    if (filtros.matriculaId) q = q.where('c.matricula_id', '=', filtros.matriculaId);
    if (filtros.concepto) q = q.where('c.concepto', '=', filtros.concepto);
    if (filtros.seccionId) q = q.where(sql<boolean>`${seccionActualId('m')} = ${filtros.seccionId}::bigint`);
    if (filtros.estado) q = q.where(condicionEstado(filtros.estado));
    if (filtros.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || e.codigo) ilike ${`%${filtros.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'c.id',
        'c.matricula_id',
        'c.estudiante_id',
        nombreAlumno('pe').as('alumno'),
        'e.codigo',
        'a.anio',
        GRADO_TEXTO.as('grado'),
        seccionActual('m').as('seccion'),
        'c.concepto',
        'c.numero',
        'c.mes_servicio',
        'c.exigible_desde',
        'c.vence_en',
        'c.importe',
        sql<string>`s.ajustes::numeric(12,2)`.as('ajustes'),
        sql<string>`s.abonado::numeric(12,2)`.as('abonado'),
        sql<string>`s.saldo::numeric(12,2)`.as('saldo'),
      ])
      .orderBy('pe.apellidos')
      .orderBy('pe.nombres')
      .orderBy('c.vence_en')
      .orderBy(ordenConcepto('c.concepto'))
      .orderBy('c.numero'),
    p,
  ).execute();
  return { filas: filas as FilaCuota[], total: Number(total.n) };
}

/** Cuotas de una matrícula con su saldo (orden: más antigua primero). */
export async function cuotasDeMatricula(matriculaId: string, soloConSaldo = false): Promise<CuotaConSaldo[]> {
  let q = db()
    .selectFrom('cuotas as c')
    .innerJoin('saldos_cuotas as s', 's.cuota_id', 'c.id')
    .select([
      'c.id',
      'c.concepto',
      'c.numero',
      'c.mes_servicio',
      'c.exigible_desde',
      'c.vence_en',
      'c.importe',
      sql<string>`s.ajustes::numeric(12,2)`.as('ajustes'),
      sql<string>`s.abonado::numeric(12,2)`.as('abonado'),
      sql<string>`s.saldo::numeric(12,2)`.as('saldo'),
    ])
    .where('c.matricula_id', '=', matriculaId);
  if (soloConSaldo) q = q.where(sql<boolean>`s.saldo > 0`);
  return q.orderBy('c.vence_en').orderBy('c.exigible_desde').orderBy(ordenConcepto('c.concepto')).orderBy('c.numero').execute();
}

export async function obtenerCuota(id: string) {
  return db()
    .selectFrom('cuotas as c')
    .innerJoin('saldos_cuotas as s', 's.cuota_id', 'c.id')
    .select(['c.id', 'c.matricula_id', 'c.estudiante_id', 'c.concepto', 'c.numero', 'c.importe', sql<string>`s.saldo::numeric(12,2)`.as('saldo')])
    .where('c.id', '=', id)
    .executeTakeFirst();
}

/**
 * Bloquea la cuota con un UPDATE sin cambios (el trigger lo permite como bloqueo de fila) y lee su saldo.
 * Así dos ajustes simultáneos no calculan sobre el mismo saldo.
 */
export async function bloquearCuota(id: string) {
  const r = await db().updateTable('cuotas').set({ importe: sql`importe` }).where('id', '=', id).returning(['id']).executeTakeFirst();
  if (!r) return undefined;
  return obtenerCuota(id);
}

export async function tramosDePlan(planId: string) {
  return db()
    .selectFrom('tramos_plan_cobro')
    .select(['id', 'concepto', 'numero', 'importe', 'mes_servicio', 'exigible_desde', 'vence_en'])
    .where('plan_id', '=', planId)
    .orderBy(ordenConcepto('concepto'))
    .orderBy('numero')
    .execute();
}

/** Claves `concepto-numero` y meses de servicio ya emitidos para la matrícula. */
export async function cuotasEmitidas(matriculaId: string) {
  const filas = await db().selectFrom('cuotas').select(['concepto', 'numero', 'mes_servicio']).where('matricula_id', '=', matriculaId).execute();
  return {
    claves: new Set(filas.map((f) => `${f.concepto}-${f.numero}`)),
    meses: new Set(filas.map((f) => f.mes_servicio).filter((m): m is string => m !== null)),
  };
}

export async function insertarCuota(v: {
  matriculaId: string;
  estudianteId: string;
  anioId: string;
  gradoId: string;
  tramoId: string;
  concepto: string;
  obligacionIngresoId: string | null;
  numero: number;
  importe: string;
  mesServicio: string | null;
  exigibleDesde: string;
  venceEn: string;
}) {
  return db()
    .insertInto('cuotas')
    .values({
      matricula_id: v.matriculaId,
      estudiante_id: v.estudianteId,
      anio_id: v.anioId,
      grado_id: v.gradoId,
      tramo_id: v.tramoId,
      concepto: v.concepto,
      obligacion_ingreso_id: v.obligacionIngresoId,
      numero: v.numero,
      importe: v.importe,
      mes_servicio: v.mesServicio,
      exigible_desde: v.exigibleDesde,
      vence_en: v.venceEn,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export interface MatriculaEmision {
  id: string;
  estudiante_id: string;
  anio_id: string;
  grado_id: string;
  estado: string;
  alumno: string;
}

function consultaMatriculas() {
  return db()
    .selectFrom('matriculas as m')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
    .select(['m.id', 'm.estudiante_id', 'm.anio_id', 'm.grado_id', 'm.estado', nombreAlumno('pe').as('alumno')]);
}

export async function matriculaParaEmision(matriculaId: string): Promise<MatriculaEmision | undefined> {
  return consultaMatriculas().where('m.id', '=', matriculaId).executeTakeFirst();
}

/** Matrículas ACTIVAS de una sección (según su ubicación más reciente) o de un grado del año. */
export async function matriculasActivas(alcance: { seccionId: string } | { anioId: string; gradoId: string }): Promise<MatriculaEmision[]> {
  let q = consultaMatriculas().where('m.estado', '=', 'activa');
  if ('seccionId' in alcance) q = q.where(sql<boolean>`${seccionActualId('m')} = ${alcance.seccionId}::bigint`);
  else q = q.where('m.anio_id', '=', alcance.anioId).where('m.grado_id', '=', alcance.gradoId);
  return q.orderBy('pe.apellidos').orderBy('pe.nombres').execute();
}

export async function seccionBasica(seccionId: string) {
  return db().selectFrom('secciones').select(['id', 'anio_id', 'grado_id', 'nombre']).where('id', '=', seccionId).executeTakeFirst();
}

export async function crearAjuste(cuotaId: string, d: { tipo: string; importe: string; motivo: string }, autorizadoPor: string) {
  return db()
    .insertInto('ajustes_cuota')
    .values({ cuota_id: cuotaId, tipo: d.tipo, importe: d.importe, motivo: d.motivo, autorizado_por: autorizadoPor })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function listarAjustes(cuotaId: string): Promise<FilaAjuste[]> {
  const filas = await db()
    .selectFrom('ajustes_cuota as j')
    .innerJoin('usuarios as u', 'u.id', 'j.autorizado_por')
    .select(['j.id', 'j.cuota_id', 'j.tipo', 'j.importe', 'j.motivo', 'u.login as autorizado_por', 'j.registrado_en'])
    .where('j.cuota_id', '=', cuotaId)
    .orderBy('j.registrado_en')
    .execute();
  return filas.map((f) => ({ ...f, registrado_en: aIso(f.registrado_en) ?? '' }));
}
