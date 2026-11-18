import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type {
  CondicionEconomica,
  DatosEditarPlan,
  DatosPlan,
  DatosTramo,
  FilaObligacion,
  FilaPlan,
  FilaTramo,
} from '@/esquemas/cobros/planes';
import { GRADO_TEXTO, HOY_LIMA, aIso, nombreAlumno, ordenConcepto } from './comunes';

// Repositorio: planes de cobro, tramos, condiciones econÃ³micas y obligaciones de ingreso.

export async function listarPlanes(
  filtros: { id?: string; anioId?: string; gradoId?: string; estado?: 'borrador' | 'publicado'; q?: string },
  p: Paginacion | null,
) {
  const base = () => {
    let q = db()
      .selectFrom('planes_cobro as p')
      .innerJoin('anios_academicos as a', 'a.id', 'p.anio_id')
      .innerJoin('grados as g', 'g.id', 'p.grado_id')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id');
    if (filtros.id) q = q.where('p.id', '=', filtros.id);
    if (filtros.anioId) q = q.where('p.anio_id', '=', filtros.anioId);
    if (filtros.gradoId) q = q.where('p.grado_id', '=', filtros.gradoId);
    if (filtros.estado === 'publicado') q = q.where('p.publicado_en', 'is not', null);
    if (filtros.estado === 'borrador') q = q.where('p.publicado_en', 'is', null);
    if (filtros.q) q = q.where(sql<boolean>`(a.anio::text || ' ' || g.numero || ' ' || n.nombre) ilike ${`%${filtros.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        'p.id',
        'p.anio_id',
        'a.anio',
        'p.grado_id',
        GRADO_TEXTO.as('grado'),
        'p.version',
        'p.pension_referencia',
        'p.vigente_desde',
        'p.publicado_en',
        'p.condiciones_id',
        eb.selectFrom('documentos_institucionales as d').select('d.version').whereRef('d.id', '=', 'p.condiciones_id').as('condiciones_version'),
        eb.selectFrom('tramos_plan_cobro as t').select((e) => e.fn.countAll<string>().as('n')).whereRef('t.plan_id', '=', 'p.id').as('tramos'),
        eb
          .selectFrom('tramos_plan_cobro as t')
          .select(sql<string>`coalesce(sum(t.importe), 0)::numeric(12,2)`.as('s'))
          .whereRef('t.plan_id', '=', 'p.id')
          .as('total'),
        eb
          .selectFrom('cuotas as c')
          .innerJoin('tramos_plan_cobro as t', 't.id', 'c.tramo_id')
          .select((e) => e.fn.countAll<string>().as('n'))
          .whereRef('t.plan_id', '=', 'p.id')
          .as('cuotas'),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy('g.nivel_id')
      .orderBy('g.numero')
      .orderBy('p.version', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaPlan => ({
        ...f,
        publicado_en: aIso(f.publicado_en),
        condiciones_version: f.condiciones_version ?? null,
        tramos: Number(f.tramos ?? 0),
        total: String(f.total ?? '0'),
        cuotas: Number(f.cuotas ?? 0),
      }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerPlan(id: string): Promise<FilaPlan | undefined> {
  const { filas } = await listarPlanes({ id }, { limite: 1, desplazamiento: 0 });
  return filas[0];
}

/** Bloquea el plan (FOR UPDATE) y devuelve su estado de publicaciÃ³n. */
export async function bloquearPlan(id: string) {
  return db()
    .selectFrom('planes_cobro')
    .select(['id', 'anio_id', 'grado_id', 'version', 'publicado_en', 'condiciones_id'])
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
}

export async function siguienteVersion(anioId: string, gradoId: string): Promise<number> {
  const f = await db()
    .selectFrom('planes_cobro')
    .select(sql<number>`coalesce(max(version), 0) + 1`.as('v'))
    .where('anio_id', '=', anioId)
    .where('grado_id', '=', gradoId)
    .executeTakeFirstOrThrow();
  return Number(f.v);
}

export async function crearPlan(d: Omit<DatosPlan, 'condicionesId'> & { condicionesId: string | null }, version: number) {
  return db()
    .insertInto('planes_cobro')
    .values({
      anio_id: d.anioId,
      grado_id: d.gradoId,
      version,
      pension_referencia: d.pensionReferencia,
      vigente_desde: d.vigenteDesde,
      condiciones_id: d.condicionesId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Solo borradores: un plan publicado no se edita (se crea una versiÃ³n nueva). */
export async function actualizarPlanBorrador(id: string, d: Omit<DatosEditarPlan, 'condicionesId'> & { condicionesId: string | null }) {
  return db()
    .updateTable('planes_cobro')
    .set({ pension_referencia: d.pensionReferencia, vigente_desde: d.vigenteDesde, condiciones_id: d.condicionesId })
    .where('id', '=', id)
    .where('publicado_en', 'is', null)
    .returning(['id'])
    .executeTakeFirst();
}

/** Publica el borrador (la base exige condiciones, pensiÃ³n de referencia y vigencia mediante CHECK). */
export async function publicarPlan(id: string, condicionesId: string | null) {
  return db()
    .updateTable('planes_cobro')
    .set({ publicado_en: sql`now()`, condiciones_id: sql`coalesce(condiciones_id, ${condicionesId}::bigint)` })
    .where('id', '=', id)
    .where('publicado_en', 'is', null)
    .returning(['id', 'publicado_en'])
    .executeTakeFirst();
}

/** Copia el plan y sus tramos como un nuevo borrador (versiÃ³n siguiente). */
export async function copiarComoNuevaVersion(planId: string, version: number) {
  const nuevo = await db()
    .insertInto('planes_cobro')
    .columns(['anio_id', 'grado_id', 'version', 'condiciones_id', 'pension_referencia', 'vigente_desde'])
    .expression((eb) =>
      eb
        .selectFrom('planes_cobro')
        .select([
          'anio_id',
          'grado_id',
          sql<number>`${version}::int`.as('version'),
          'condiciones_id',
          'pension_referencia',
          'vigente_desde',
        ])
        .where('id', '=', planId),
    )
    .returning(['id'])
    .executeTakeFirstOrThrow();
  await db()
    .insertInto('tramos_plan_cobro')
    .columns(['plan_id', 'anio_id', 'grado_id', 'concepto', 'numero', 'importe', 'mes_servicio', 'exigible_desde', 'vence_en'])
    .expression((eb) =>
      eb
        .selectFrom('tramos_plan_cobro')
        .select([
          sql<string>`${nuevo.id}::bigint`.as('plan_id'),
          'anio_id',
          'grado_id',
          'concepto',
          'numero',
          'importe',
          'mes_servicio',
          'exigible_desde',
          'vence_en',
        ])
        .where('plan_id', '=', planId),
    )
    .execute();
  return nuevo;
}

export async function listarTramos(planId: string): Promise<FilaTramo[]> {
  return db()
    .selectFrom('tramos_plan_cobro as t')
    .select(['t.id', 't.plan_id', 't.concepto', 't.numero', 't.importe', 't.mes_servicio', 't.exigible_desde', 't.vence_en'])
    .where('t.plan_id', '=', planId)
    .orderBy(ordenConcepto('t.concepto'))
    .orderBy('t.numero')
    .execute();
}

export async function obtenerTramo(id: string) {
  return db()
    .selectFrom('tramos_plan_cobro as t')
    .innerJoin('planes_cobro as p', 'p.id', 't.plan_id')
    .select(['t.id', 't.plan_id', 't.anio_id', 't.grado_id', 'p.publicado_en'])
    .where('t.id', '=', id)
    .executeTakeFirst();
}

export async function crearTramo(plan: { id: string; anio_id: string; grado_id: string }, d: DatosTramo) {
  return db()
    .insertInto('tramos_plan_cobro')
    .values({
      plan_id: plan.id,
      anio_id: plan.anio_id,
      grado_id: plan.grado_id,
      concepto: d.concepto,
      numero: d.numero,
      importe: d.importe,
      mes_servicio: d.mesServicio,
      exigible_desde: d.exigibleDesde,
      vence_en: d.venceEn,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarTramo(id: string, d: DatosTramo) {
  return db()
    .updateTable('tramos_plan_cobro')
    .set({
      concepto: d.concepto,
      numero: d.numero,
      importe: d.importe,
      mes_servicio: d.mesServicio,
      exigible_desde: d.exigibleDesde,
      vence_en: d.venceEn,
    })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function eliminarTramo(id: string) {
  return db().deleteFrom('tramos_plan_cobro').where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarPensiones(planId: string) {
  await db().deleteFrom('tramos_plan_cobro').where('plan_id', '=', planId).where('concepto', '=', 'pension').execute();
}

/**
 * Condiciones econÃ³micas publicadas del aÃ±o (documentos_institucionales tipo 'condiciones_economicas'),
 * de la versiÃ³n mÃ¡s reciente a la mÃ¡s antigua. Las ya vigentes a la fecha van primero.
 */
export async function condicionesPublicadas(anioId: string): Promise<CondicionEconomica[]> {
  const filas = await db()
    .selectFrom('documentos_institucionales as d')
    .select(['d.id', 'd.version', 'd.vigente_desde', 'd.publicado_en', sql<boolean>`coalesce(d.vigente_desde <= ${HOY_LIMA}, false)`.as('vigente')])
    .where('d.anio_id', '=', anioId)
    .where('d.tipo', '=', 'condiciones_economicas')
    .where('d.publicado_en', 'is not', null)
    .where(sql<boolean>`d.publicado_en <= now()`)
    .orderBy(sql`coalesce(d.vigente_desde <= ${HOY_LIMA}, false)`, 'desc')
    .orderBy('d.version', 'desc')
    .execute();
  return filas.map((f) => ({ id: f.id, version: f.version, vigente_desde: f.vigente_desde, publicado_en: aIso(f.publicado_en) }));
}

/** Plan publicado y vigente hoy para el aÃ±o y grado (la versiÃ³n mÃ¡s reciente). */
export async function planVigente(anioId: string, gradoId: string) {
  return db()
    .selectFrom('planes_cobro')
    .select(['id', 'version', 'anio_id', 'grado_id'])
    .where('anio_id', '=', anioId)
    .where('grado_id', '=', gradoId)
    .where('publicado_en', 'is not', null)
    .where(sql<boolean>`publicado_en <= now()`)
    .where(sql<boolean>`vigente_desde <= ${HOY_LIMA}`)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst();
}

// ---------- Obligaciones de ingreso ----------

export async function listarObligaciones(filtros: { q?: string; anioId?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('obligaciones_ingreso as o')
      .innerJoin('estudiantes as e', 'e.id', 'o.estudiante_id')
      .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
      .innerJoin('matriculas as m', 'm.id', 'o.matricula_ingreso_id')
      .innerJoin('anios_academicos as a', 'a.id', 'm.anio_id')
      .innerJoin('grados as g', 'g.id', 'm.grado_id')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
      .innerJoin('documentos_institucionales as d', 'd.id', 'o.condiciones_id');
    if (filtros.anioId) q = q.where('m.anio_id', '=', filtros.anioId);
    if (filtros.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || e.codigo) ilike ${`%${filtros.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        'o.id',
        'o.estudiante_id',
        nombreAlumno('pe').as('alumno'),
        'e.codigo',
        'o.matricula_ingreso_id',
        'a.anio',
        GRADO_TEXTO.as('grado'),
        'o.importe_acordado',
        'o.condiciones_id',
        'd.version as condiciones_version',
        eb.selectFrom('cuotas as c').select(sql<string>`coalesce(sum(c.importe), 0)::numeric(12,2)`.as('s')).whereRef('c.obligacion_ingreso_id', '=', 'o.id').as('emitido'),
        eb.selectFrom('cuotas as c').select((e) => e.fn.countAll<string>().as('n')).whereRef('c.obligacion_ingreso_id', '=', 'o.id').as('cuotas'),
      ])
      .orderBy('pe.apellidos')
      .orderBy('pe.nombres'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaObligacion => ({ ...f, emitido: String(f.emitido ?? '0'), cuotas: Number(f.cuotas ?? 0) })),
    total: Number(total.n),
  };
}

export async function obtenerObligacion(id: string) {
  return db()
    .selectFrom('obligaciones_ingreso as o')
    .select((eb) => [
      'o.id',
      'o.estudiante_id',
      'o.matricula_ingreso_id',
      'o.importe_acordado',
      'o.condiciones_id',
      eb.selectFrom('cuotas as c').select((e) => e.fn.countAll<string>().as('n')).whereRef('c.obligacion_ingreso_id', '=', 'o.id').as('cuotas'),
    ])
    .where('o.id', '=', id)
    .executeTakeFirst();
}

export async function obligacionDeEstudiante(estudianteId: string) {
  return db()
    .selectFrom('obligaciones_ingreso')
    .select(['id', 'estudiante_id', 'matricula_ingreso_id', 'importe_acordado', 'condiciones_id'])
    .where('estudiante_id', '=', estudianteId)
    .executeTakeFirst();
}

export async function crearObligacion(d: { estudianteId: string; matriculaId: string; importeAcordado: string; condicionesId: string }) {
  return db()
    .insertInto('obligaciones_ingreso')
    .values({
      estudiante_id: d.estudianteId,
      matricula_ingreso_id: d.matriculaId,
      importe_acordado: d.importeAcordado,
      condiciones_id: d.condicionesId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarObligacion(id: string, d: { importeAcordado: string; condicionesId: string }) {
  return db()
    .updateTable('obligaciones_ingreso')
    .set({ importe_acordado: d.importeAcordado, condiciones_id: d.condicionesId })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function matriculaBasica(matriculaId: string) {
  return db()
    .selectFrom('matriculas as m')
    .innerJoin('anios_academicos as a', 'a.id', 'm.anio_id')
    .select(['m.id', 'm.estudiante_id', 'm.anio_id', 'm.grado_id', 'm.estado', 'a.anio'])
    .where('m.id', '=', matriculaId)
    .executeTakeFirst();
}
