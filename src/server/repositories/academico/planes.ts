import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { AsignaturaDelPlan, CompetenciaDelPlan, DetallePlan, FilaPlan, SeccionDelPlan } from '@/esquemas/academico/planes';
import { ETIQUETA_GRADO, ETIQUETA_SECCION, vigencia } from './comunes';

// Planes de estudio versionados, su contenido (asignaturas, competencias, mapeo) y su aplicación a secciones.

const CONTEOS = {
  asignaturas: sql<string>`(select count(*) from plan_asignaturas x where x.plan_id = pe.id)`,
  competencias: sql<string>`(select count(*) from plan_competencias x where x.plan_id = pe.id)`,
  secciones: sql<string>`(select count(*) from seccion_planes_estudio x where x.plan_id = pe.id)`,
};

function filaPlan(r: {
  id: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: string;
  version: number;
  publicado_en: Date | null;
  asignaturas: string;
  competencias: string;
  secciones: string;
}): FilaPlan {
  return {
    ...r,
    publicado_en: r.publicado_en ? r.publicado_en.toISOString() : null,
    asignaturas: Number(r.asignaturas),
    competencias: Number(r.competencias),
    secciones: Number(r.secciones),
  };
}

function consultaBase() {
  return db()
    .selectFrom('planes_estudio as pe')
    .innerJoin('anios_academicos as a', 'a.id', 'pe.anio_id')
    .innerJoin('grados as g', 'g.id', 'pe.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id');
}

export async function listarPlanes(f: { anioId?: string; gradoId?: string; estado?: string; q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = consultaBase();
    if (f.anioId) q = q.where('pe.anio_id', '=', f.anioId);
    if (f.gradoId) q = q.where('pe.grado_id', '=', f.gradoId);
    if (f.estado === 'publicado') q = q.where('pe.publicado_en', 'is not', null);
    if (f.estado === 'borrador') q = q.where('pe.publicado_en', 'is', null);
    if (f.q) q = q.where(sql<boolean>`(a.anio::text || ' ' || ${ETIQUETA_GRADO}) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'pe.id',
        'pe.anio_id',
        'a.anio',
        'pe.grado_id',
        ETIQUETA_GRADO.as('grado'),
        'pe.version',
        'pe.publicado_en',
        CONTEOS.asignaturas.as('asignaturas'),
        CONTEOS.competencias.as('competencias'),
        CONTEOS.secciones.as('secciones'),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy('n.id')
      .orderBy('g.numero')
      .orderBy('pe.version', 'desc'),
    p,
  ).execute();
  return { filas: filas.map(filaPlan), total: Number(total.n) };
}

export async function obtenerPlan(id: string) {
  return db()
    .selectFrom('planes_estudio as pe')
    .innerJoin('anios_academicos as a', 'a.id', 'pe.anio_id')
    .select(['pe.id', 'pe.anio_id', 'pe.grado_id', 'pe.version', 'pe.publicado_en', 'a.inicio as anio_inicio', 'a.fin as anio_fin'])
    .where('pe.id', '=', id)
    .executeTakeFirst();
}

export async function detallePlan(id: string): Promise<DetallePlan | undefined> {
  const r = await consultaBase()
    .select([
      'pe.id',
      'pe.anio_id',
      'a.anio',
      'a.inicio as anio_inicio',
      'a.fin as anio_fin',
      'pe.grado_id',
      ETIQUETA_GRADO.as('grado'),
      'pe.version',
      'pe.publicado_en',
      CONTEOS.asignaturas.as('asignaturas'),
      CONTEOS.competencias.as('competencias'),
      CONTEOS.secciones.as('secciones'),
    ])
    .where('pe.id', '=', id)
    .executeTakeFirst();
  if (!r) return undefined;
  const asignaturas = await db()
    .selectFrom('plan_asignaturas as pa')
    .innerJoin('asignaturas as x', 'x.id', 'pa.asignatura_id')
    .select((eb) => [
      'pa.asignatura_id',
      'x.codigo',
      'x.nombre',
      'x.es_taller',
      eb
        .selectFrom('asignatura_competencias as ac')
        .select(sql<string[]>`coalesce(array_agg(ac.competencia_id::text order by ac.competencia_id), '{}')`.as('l'))
        .whereRef('ac.plan_id', '=', 'pa.plan_id')
        .whereRef('ac.asignatura_id', '=', 'pa.asignatura_id')
        .as('competencias'),
    ])
    .where('pa.plan_id', '=', id)
    .orderBy('x.nombre')
    .execute();
  const competencias = await db()
    .selectFrom('plan_competencias as pc')
    .innerJoin('competencias as c', 'c.id', 'pc.competencia_id')
    .leftJoin('areas_curriculares as ar', 'ar.id', 'c.area_id')
    .select(['pc.competencia_id', 'c.codigo', 'c.nombre', 'c.version', 'c.reportable_siagie', 'ar.nombre as area'])
    .where('pc.plan_id', '=', id)
    .orderBy('c.codigo')
    .execute();
  const secciones = await db()
    .selectFrom('seccion_planes_estudio as sp')
    .innerJoin('secciones as s', 's.id', 'sp.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([
      'sp.id',
      'sp.seccion_id',
      ETIQUETA_SECCION.as('seccion'),
      'sp.vigencia',
      sql<string>`(select count(*) from cursos_seccion c where c.seccion_plan_id = sp.id)`.as('cursos'),
    ])
    .where('sp.plan_id', '=', id)
    .orderBy('s.nombre')
    .orderBy(sql`lower(sp.vigencia)`)
    .execute();
  return {
    ...filaPlan(r),
    anio_inicio: r.anio_inicio,
    anio_fin: r.anio_fin,
    lista_asignaturas: asignaturas.map((a): AsignaturaDelPlan => ({ ...a, competencias: a.competencias ?? [] })),
    lista_competencias: competencias as CompetenciaDelPlan[],
    lista_secciones: secciones.map(
      (s): SeccionDelPlan => ({ id: s.id, seccion_id: s.seccion_id, seccion: s.seccion, ...vigencia(s.vigencia), cursos: Number(s.cursos) }),
    ),
  };
}

export async function siguienteVersion(anioId: string, gradoId: string) {
  const r = await db()
    .selectFrom('planes_estudio')
    .select(sql<number>`coalesce(max(version), 0) + 1`.as('v'))
    .where('anio_id', '=', anioId)
    .where('grado_id', '=', gradoId)
    .executeTakeFirstOrThrow();
  return Number(r.v);
}

export async function crearPlan(d: { anioId: string; gradoId: string; version: number }) {
  return db()
    .insertInto('planes_estudio')
    .values({ anio_id: d.anioId, grado_id: d.gradoId, version: d.version })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Copia asignaturas, competencias y mapeo de un plan a otro (nueva versión). */
export async function copiarContenido(origenId: string, destinoId: string) {
  await db()
    .insertInto('plan_asignaturas')
    .columns(['plan_id', 'asignatura_id'])
    .expression((eb) => eb.selectFrom('plan_asignaturas').select([sql<string>`${destinoId}::bigint`.as('plan_id'), 'asignatura_id']).where('plan_id', '=', origenId))
    .execute();
  await db()
    .insertInto('plan_competencias')
    .columns(['plan_id', 'competencia_id'])
    .expression((eb) => eb.selectFrom('plan_competencias').select([sql<string>`${destinoId}::bigint`.as('plan_id'), 'competencia_id']).where('plan_id', '=', origenId))
    .execute();
  await db()
    .insertInto('asignatura_competencias')
    .columns(['plan_id', 'asignatura_id', 'competencia_id'])
    .expression((eb) =>
      eb.selectFrom('asignatura_competencias').select([sql<string>`${destinoId}::bigint`.as('plan_id'), 'asignatura_id', 'competencia_id']).where('plan_id', '=', origenId),
    )
    .execute();
}

export async function agregarAsignatura(planId: string, asignaturaId: string) {
  await db().insertInto('plan_asignaturas').values({ plan_id: planId, asignatura_id: asignaturaId }).execute();
}

export async function quitarAsignatura(planId: string, asignaturaId: string) {
  await db().deleteFrom('asignatura_competencias').where('plan_id', '=', planId).where('asignatura_id', '=', asignaturaId).execute();
  return db().deleteFrom('plan_asignaturas').where('plan_id', '=', planId).where('asignatura_id', '=', asignaturaId).returning('plan_id').executeTakeFirst();
}

export async function agregarCompetencia(planId: string, competenciaId: string) {
  await db().insertInto('plan_competencias').values({ plan_id: planId, competencia_id: competenciaId }).execute();
}

export async function quitarCompetencia(planId: string, competenciaId: string) {
  await db().deleteFrom('asignatura_competencias').where('plan_id', '=', planId).where('competencia_id', '=', competenciaId).execute();
  return db().deleteFrom('plan_competencias').where('plan_id', '=', planId).where('competencia_id', '=', competenciaId).returning('plan_id').executeTakeFirst();
}

/** Reemplaza las competencias que califica una asignatura del plan (las FK exigen que ambas estén en el plan). */
export async function reemplazarMapeo(planId: string, asignaturaId: string, competenciaIds: string[]) {
  await db().deleteFrom('asignatura_competencias').where('plan_id', '=', planId).where('asignatura_id', '=', asignaturaId).execute();
  if (competenciaIds.length === 0) return;
  await db()
    .insertInto('asignatura_competencias')
    .values([...new Set(competenciaIds)].map((c) => ({ plan_id: planId, asignatura_id: asignaturaId, competencia_id: c })))
    .execute();
}

export async function publicar(planId: string) {
  return db()
    .updateTable('planes_estudio')
    .set({ publicado_en: sql<Date>`now()` })
    .where('id', '=', planId)
    .where('publicado_en', 'is', null)
    .returning(['id', 'publicado_en'])
    .executeTakeFirst();
}

/** Elimina un plan en borrador con su contenido (un plan publicado no se elimina). */
export async function eliminarBorrador(planId: string) {
  await db().deleteFrom('asignatura_competencias').where('plan_id', '=', planId).execute();
  await db().deleteFrom('plan_competencias').where('plan_id', '=', planId).execute();
  await db().deleteFrom('plan_asignaturas').where('plan_id', '=', planId).execute();
  return db().deleteFrom('planes_estudio').where('id', '=', planId).where('publicado_en', 'is', null).returning('id').executeTakeFirst();
}

/** Aplica el plan a la sección (la base valida publicado, vigencia dentro del año y sin solapes). */
export async function asignarSeccion(plan: { id: string; anio_id: string; grado_id: string }, seccionId: string, vigenciaTexto: string) {
  return db()
    .insertInto('seccion_planes_estudio')
    .values({ seccion_id: seccionId, plan_id: plan.id, anio_id: plan.anio_id, grado_id: plan.grado_id, vigencia: vigenciaTexto })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Crea un curso por cada asignatura del plan en la sección (omite los que ya existan). */
export async function crearCursosDeSeccionPlan(seccionPlan: { id: string; plan_id: string; seccion_id: string }) {
  const r = await db()
    .insertInto('cursos_seccion')
    .columns(['seccion_plan_id', 'plan_id', 'seccion_id', 'asignatura_id'])
    .expression((eb) =>
      eb
        .selectFrom('plan_asignaturas')
        .select([
          sql<string>`${seccionPlan.id}::bigint`.as('seccion_plan_id'),
          'plan_id',
          sql<string>`${seccionPlan.seccion_id}::bigint`.as('seccion_id'),
          'asignatura_id',
        ])
        .where('plan_id', '=', seccionPlan.plan_id),
    )
    .onConflict((oc) => oc.columns(['seccion_plan_id', 'asignatura_id']).doNothing())
    .returning('id')
    .execute();
  return r.length;
}

export async function obtenerSeccionPlan(id: string) {
  return db().selectFrom('seccion_planes_estudio').select(['id', 'seccion_id', 'plan_id', 'anio_id', 'grado_id', 'vigencia']).where('id', '=', id).executeTakeFirst();
}

export async function actualizarVigenciaSeccionPlan(id: string, vigenciaTexto: string) {
  return db().updateTable('seccion_planes_estudio').set({ vigencia: vigenciaTexto }).where('id', '=', id).returning(['id']).executeTakeFirst();
}
