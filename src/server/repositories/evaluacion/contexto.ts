import 'server-only';
import { db, sql } from '@/server/db';

// Consultas de contexto compartidas por el módulo de evaluación (sección, bimestre, curso, plan, nómina).

export async function obtenerBimestre(id: string) {
  return db()
    .selectFrom('bimestres')
    .select(['id', 'anio_id', 'numero', 'inicio', 'fin', 'registro_inicio', 'registro_fin'])
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function bimestresDelAnio(anioId: string) {
  return db().selectFrom('bimestres').select(['id', 'numero', 'inicio', 'fin']).where('anio_id', '=', anioId).orderBy('numero').execute();
}

export async function obtenerSeccion(id: string) {
  return db()
    .selectFrom('secciones as s')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('anios_academicos as a', 'a.id', 's.anio_id')
    .select(['s.id', 's.nombre', 's.anio_id', 's.grado_id', 's.activa', 'g.numero as grado', 'n.codigo as nivel_codigo', 'n.nombre as nivel', 'a.anio'])
    .where('s.id', '=', id)
    .executeTakeFirst();
}

export async function obtenerCurso(cursoId: string) {
  return db()
    .selectFrom('cursos_seccion as c')
    .innerJoin('asignaturas as a', 'a.id', 'c.asignatura_id')
    .innerJoin('secciones as s', 's.id', 'c.seccion_id')
    .select(['c.id', 'c.plan_id', 'c.asignatura_id', 'c.seccion_id', 'c.activo', 'a.nombre as asignatura', 's.anio_id'])
    .where('c.id', '=', cursoId)
    .executeTakeFirst();
}

/** Cursos activos de una sección (para filtrar la grilla administrativa). */
export async function cursosDeSeccion(seccionId: string) {
  return db()
    .selectFrom('cursos_seccion as c')
    .innerJoin('asignaturas as a', 'a.id', 'c.asignatura_id')
    .select(['c.id', 'a.nombre as asignatura', 'c.plan_id'])
    .where('c.seccion_id', '=', seccionId)
    .where('c.activo', '=', true)
    .orderBy('a.nombre')
    .execute();
}

/** Plan vigente de la sección en la fecha (seccion_planes_estudio). */
export async function planDeSeccionEn(seccionId: string, fecha: string) {
  const f = await db()
    .selectFrom('seccion_planes_estudio')
    .select('plan_id')
    .where('seccion_id', '=', seccionId)
    .where(sql<boolean>`vigencia @> ${fecha}::date`)
    .executeTakeFirst();
  return f?.plan_id ?? null;
}

const COMPETENCIA_CAMPOS = ['k.id', 'k.codigo', 'k.nombre', 'ar.nombre as area', 'ar.codigo as area_codigo'] as const;

/** Competencias que califica la asignatura en el plan (asignatura_competencias). */
export async function competenciasDeCurso(planId: string, asignaturaId: string) {
  return db()
    .selectFrom('asignatura_competencias as ac')
    .innerJoin('competencias as k', 'k.id', 'ac.competencia_id')
    .leftJoin('areas_curriculares as ar', 'ar.id', 'k.area_id')
    .select(COMPETENCIA_CAMPOS)
    .where('ac.plan_id', '=', planId)
    .where('ac.asignatura_id', '=', asignaturaId)
    .orderBy('ar.nombre')
    .orderBy('k.codigo')
    .execute();
}

/** Todas las competencias del plan (plan_competencias). */
export async function competenciasDePlan(planId: string) {
  return db()
    .selectFrom('plan_competencias as pc')
    .innerJoin('competencias as k', 'k.id', 'pc.competencia_id')
    .leftJoin('areas_curriculares as ar', 'ar.id', 'k.area_id')
    .select([...COMPETENCIA_CAMPOS, 'k.reportable_siagie'])
    .where('pc.plan_id', '=', planId)
    .orderBy('ar.nombre')
    .orderBy('k.codigo')
    .execute();
}

/**
 * Alumnos con matrícula (no anulada) ubicados en la sección en algún momento del período.
 * `en_nomina` = ubicados al cierre del período (los que la base exige completos al cerrar).
 */
export async function alumnosDeSeccionEnPeriodo(seccionId: string, inicio: string, fin: string) {
  return db()
    .selectFrom('matricula_secciones as ms')
    .innerJoin('matriculas as m', 'm.id', 'ms.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select([
      'm.id as matricula_id',
      'e.id as estudiante_id',
      'e.codigo',
      'p.nombres',
      'p.apellidos',
      'm.estado',
      sql<boolean>`bool_or(ms.vigencia @> ${fin}::date)`.as('en_nomina'),
    ])
    .where('ms.seccion_id', '=', seccionId)
    .where('m.estado', '<>', 'anulada')
    .where(sql<boolean>`ms.vigencia && daterange(${inicio}::date, ${fin}::date, '[]')`)
    .groupBy(['m.id', 'e.id', 'e.codigo', 'p.nombres', 'p.apellidos', 'm.estado'])
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .execute();
}

export async function cierreDeSeccion(seccionId: string, bimestreId: string) {
  return db()
    .selectFrom('cierres_evaluacion')
    .select(['id', 'estado', 'seccion_id', 'bimestre_id', 'anio_id', 'grado_id'])
    .where('seccion_id', '=', seccionId)
    .where('bimestre_id', '=', bimestreId)
    .executeTakeFirst();
}

/** Fin del 4.º bimestre del año (fecha de corte del cierre anual). */
export async function finCuartoBimestre(anioId: string) {
  const f = await db().selectFrom('bimestres').select('fin').where('anio_id', '=', anioId).where('numero', '=', 4).executeTakeFirst();
  return f?.fin ?? null;
}

/** Última versión APROBADA de la regla de evaluación del año y grado. */
export async function reglaAprobadaVigente(anioId: string, gradoId: string) {
  return db()
    .selectFrom('reglas_evaluacion')
    .select(['id', 'version', 'criterios', 'referencia_normativa'])
    .where('anio_id', '=', anioId)
    .where('grado_id', '=', gradoId)
    .where('aprobado_en', 'is not', null)
    .orderBy('version', 'desc')
    .executeTakeFirst();
}
