import 'server-only';
import { db, sql } from '@/server/db';
import type { Celda } from '@/esquemas/evaluacion/calificaciones';

// Calificaciones por competencia. Las reglas (motivo de rectificación, cierre en borrador, matrícula en la
// sección durante el bimestre, identidad inmutable, historial) las imponen los triggers de la base.

export async function calificacionesDe(bimestreId: string, matriculaIds: string[], competenciaIds: string[]) {
  if (!matriculaIds.length || !competenciaIds.length) return [];
  return db()
    .selectFrom('calificaciones_competencia')
    .select(['id', 'matricula_id', 'competencia_id', 'cierre_id', 'estado', 'nivel_logro', 'conclusion', 'actualizado_en', 'motivo_cambio'])
    .where('bimestre_id', '=', bimestreId)
    .where('matricula_id', 'in', matriculaIds)
    .where('competencia_id', 'in', competenciaIds)
    .execute();
}

export async function insertarCalificacion(d: {
  celda: Celda;
  bimestreId: string;
  planId: string;
  cierreId: string;
  anioId: string;
  gradoId: string;
  autorId: string;
}) {
  return db()
    .insertInto('calificaciones_competencia')
    .values({
      matricula_id: d.celda.matriculaId,
      bimestre_id: d.bimestreId,
      competencia_id: d.celda.competenciaId,
      plan_id: d.planId,
      cierre_id: d.cierreId,
      anio_id: d.anioId,
      grado_id: d.gradoId,
      estado: d.celda.estado,
      nivel_logro: d.celda.nivelLogro,
      conclusion: d.celda.conclusion,
      autor_id: d.autorId,
      motivo_cambio: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
}

/**
 * Rectificación: SIEMPRE fija `motivo_cambio` (null si no se indicó) para que la base exija el motivo en cada
 * cambio y no herede el de una rectificación anterior. El trigger guarda la revisión (anterior/nueva).
 */
export async function rectificarCalificacion(id: string, celda: Celda, autorId: string, motivo: string | null) {
  return db()
    .updateTable('calificaciones_competencia')
    .set({ estado: celda.estado, nivel_logro: celda.nivelLogro, conclusion: celda.conclusion, autor_id: autorId, motivo_cambio: motivo })
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirstOrThrow();
}

/** Revisiones (historial de rectificaciones) de las calificaciones de la sección/bimestre y competencias. */
export async function revisiones(filtro: { bimestreId: string; matriculaIds: string[]; competenciaIds: string[] }) {
  if (!filtro.matriculaIds.length || !filtro.competenciaIds.length) return [];
  return db()
    .selectFrom('revisiones_calificacion as r')
    .innerJoin('calificaciones_competencia as c', 'c.id', 'r.calificacion_id')
    .innerJoin('matriculas as m', 'm.id', 'c.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .innerJoin('competencias as k', 'k.id', 'c.competencia_id')
    .innerJoin('usuarios as u', 'u.id', 'r.autor_id')
    .select([
      'r.id',
      'r.calificacion_id',
      'c.matricula_id',
      sql<string>`p.apellidos || ', ' || p.nombres`.as('alumno'),
      sql<string>`k.codigo || ' · ' || k.nombre`.as('competencia'),
      'r.anterior',
      'r.nueva',
      'u.login as autor',
      'r.motivo',
      'r.registrado_en',
    ])
    .where('c.bimestre_id', '=', filtro.bimestreId)
    .where('c.matricula_id', 'in', filtro.matriculaIds)
    .where('c.competencia_id', 'in', filtro.competenciaIds)
    .orderBy('r.registrado_en', 'desc')
    .orderBy('r.id', 'desc')
    .limit(500)
    .execute();
}

/** Cursos del docente con asignación que se cruza con algún año académico no cerrado. */
export async function cursosCalificablesDocente(docenteId: string) {
  return db()
    .selectFrom('asignaciones_docentes as ad')
    .innerJoin('cursos_seccion as c', 'c.id', 'ad.curso_id')
    .innerJoin('asignaturas as a', 'a.id', 'c.asignatura_id')
    .innerJoin('secciones as s', 's.id', 'c.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('anios_academicos as an', 'an.id', 's.anio_id')
    .select(['c.id as curso_id', 'a.nombre as asignatura', 's.id as seccion_id', 's.nombre as seccion', 'g.numero as grado', 'n.nombre as nivel', 'an.id as anio_id', 'an.anio'])
    .distinct()
    .where('ad.docente_id', '=', docenteId)
    .where('c.activo', '=', true)
    .where('an.estado', '<>', 'cerrado')
    .where(sql<boolean>`ad.vigencia && daterange(an.inicio, an.fin, '[]')`)
    .orderBy('an.anio', 'desc')
    .orderBy('n.nombre')
    .orderBy('g.numero')
    .orderBy('s.nombre')
    .orderBy('a.nombre')
    .execute();
}

/** ¿El docente tiene una asignación en el curso que se cruza con el período? */
export async function docenteAsignadoEnPeriodo(docenteId: string, cursoId: string, inicio: string, fin: string) {
  const f = await db()
    .selectFrom('asignaciones_docentes')
    .select('id')
    .where('docente_id', '=', docenteId)
    .where('curso_id', '=', cursoId)
    .where(sql<boolean>`vigencia && daterange(${inicio}::date, ${fin}::date, '[]')`)
    .executeTakeFirst();
  return Boolean(f);
}
