import 'server-only';
import { db, sql } from '@/server/db';

const HOY_LIMA = sql<string>`(now() at time zone 'America/Lima')::date`;

export async function estudiantePorPersona(personaId: string) {
  return db()
    .selectFrom('estudiantes as e')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select(['e.id as estudiante_id', 'e.codigo', 'e.activo', 'p.nombres', 'p.apellidos'])
    .where('e.persona_id', '=', personaId)
    .executeTakeFirst();
}

export async function docentePorPersona(personaId: string) {
  return db()
    .selectFrom('docentes')
    .select(['id as docente_id', 'codigo', 'activo'])
    .where('persona_id', '=', personaId)
    .executeTakeFirst();
}

/** Hijos con vínculo `estudiante_apoderado` vigente hoy (America/Lima). */
export async function hijosDeApoderado(personaId: string) {
  return db()
    .selectFrom('estudiante_apoderado as ea')
    .innerJoin('estudiantes as e', 'e.id', 'ea.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select([
      'e.id as estudiante_id',
      'e.codigo',
      'p.nombres',
      'p.apellidos',
      'ea.parentesco',
      'ea.acceso_academico',
      'ea.acceso_economico',
    ])
    .where('ea.persona_id', '=', personaId)
    .where(sql<boolean>`ea.vigencia @> ${HOY_LIMA}`)
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .execute();
}

/** Cursos con asignación docente vigente en la fecha (por defecto hoy). */
export async function cursosDeDocente(docenteId: string, fecha?: string) {
  const dia = fecha ? sql<string>`${fecha}::date` : HOY_LIMA;
  return db()
    .selectFrom('asignaciones_docentes as ad')
    .innerJoin('cursos_seccion as c', 'c.id', 'ad.curso_id')
    .innerJoin('asignaturas as a', 'a.id', 'c.asignatura_id')
    .innerJoin('secciones as s', 's.id', 'c.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([
      'ad.id as asignacion_id',
      'ad.funcion',
      'c.id as curso_id',
      'c.plan_id',
      'c.asignatura_id',
      'a.nombre as asignatura',
      's.id as seccion_id',
      's.nombre as seccion',
      's.anio_id',
      'g.id as grado_id',
      'g.numero as grado',
      'n.nombre as nivel',
    ])
    .where('ad.docente_id', '=', docenteId)
    .where(sql<boolean>`ad.vigencia @> ${dia}`)
    .where('c.activo', '=', true)
    .orderBy('n.id')
    .orderBy('g.numero')
    .orderBy('s.nombre')
    .orderBy('a.nombre')
    .execute();
}

/** ¿El docente tuvo alguna asignación (vigente o no) en el curso o la sección? */
export async function docenteTieneCurso(docenteId: string, cursoId: string) {
  const fila = await db()
    .selectFrom('asignaciones_docentes')
    .select('id')
    .where('docente_id', '=', docenteId)
    .where('curso_id', '=', cursoId)
    .executeTakeFirst();
  return Boolean(fila);
}

export async function docenteTieneSeccion(docenteId: string, seccionId: string) {
  const fila = await db()
    .selectFrom('asignaciones_docentes as ad')
    .innerJoin('cursos_seccion as c', 'c.id', 'ad.curso_id')
    .select('ad.id')
    .where('ad.docente_id', '=', docenteId)
    .where('c.seccion_id', '=', seccionId)
    .executeTakeFirst();
  return Boolean(fila);
}

export async function matriculaDeEstudiante(matriculaId: string) {
  return db().selectFrom('matriculas').select(['id', 'estudiante_id', 'anio_id', 'grado_id', 'estado']).where('id', '=', matriculaId).executeTakeFirst();
}
