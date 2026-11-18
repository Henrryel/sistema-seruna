import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaJustificacion } from '@/esquemas/asistencia/justificaciones';

// Repositorio: justificaciones de asistencia. Las reglas (solo ausente/tarde, nace pendiente, se
// resuelve una vez) y el paso a "justificado" los imponen los triggers de la base.

/** Asistencia de alumno con su estudiante (para verificar alcance antes de justificar). */
export async function asistenciaAlumnoConEstudiante(asistenciaId: string) {
  return db()
    .selectFrom('asistencia_estudiantes as a')
    .innerJoin('matriculas as m', 'm.id', 'a.matricula_id')
    .select(['a.id', 'a.estado', 'm.estudiante_id'])
    .where('a.id', '=', asistenciaId)
    .executeTakeFirst();
}

export async function asistenciaDocenteConDocente(asistenciaId: string) {
  return db()
    .selectFrom('asistencia_docentes as a')
    .innerJoin('jornadas_docente as j', 'j.id', 'a.jornada_id')
    .select(['a.id', 'a.estado', 'j.docente_id'])
    .where('a.id', '=', asistenciaId)
    .executeTakeFirst();
}

export async function insertarJustificacion(v: {
  asistenciaEstudianteId?: string | null;
  asistenciaDocenteId?: string | null;
  solicitadaPor: string;
  motivo: string;
  evidenciaId?: string | null;
}) {
  return db()
    .insertInto('justificaciones_asistencia')
    .values({
      asistencia_estudiante_id: v.asistenciaEstudianteId ?? null,
      asistencia_docente_id: v.asistenciaDocenteId ?? null,
      solicitada_por: v.solicitadaPor,
      motivo: v.motivo,
      evidencia_id: v.evidenciaId ?? null,
    })
    .returning(['id', 'estado'])
    .executeTakeFirstOrThrow();
}

/** Resuelve una solicitud pendiente. El trigger `aplicar_justificacion` marca la asistencia "justificado". */
export async function resolverJustificacion(id: string, v: { estado: 'aprobada' | 'rechazada'; decision: string; resueltaPor: string }) {
  return db()
    .updateTable('justificaciones_asistencia')
    .set({ estado: v.estado, decision: v.decision, resuelta_por: v.resueltaPor, resuelta_en: sql`clock_timestamp()` })
    .where('id', '=', id)
    .where('estado', '=', 'pendiente')
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

export async function obtenerJustificacion(id: string) {
  return db()
    .selectFrom('justificaciones_asistencia as j')
    .leftJoin('asistencia_estudiantes as a', 'a.id', 'j.asistencia_estudiante_id')
    .leftJoin('matriculas as m', 'm.id', 'a.matricula_id')
    .leftJoin('asistencia_docentes as ad', 'ad.id', 'j.asistencia_docente_id')
    .leftJoin('jornadas_docente as jd', 'jd.id', 'ad.jornada_id')
    .select(['j.id', 'j.estado', 'j.evidencia_id', 'j.solicitada_por', 'm.estudiante_id', 'jd.docente_id'])
    .where('j.id', '=', id)
    .executeTakeFirst();
}

export async function listarJustificaciones(f: { q?: string; estado?: string; perfil?: 'alumno' | 'docente' }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('justificaciones_asistencia as j')
      .innerJoin('usuarios as us', 'us.id', 'j.solicitada_por')
      .leftJoin('usuarios as ur', 'ur.id', 'j.resuelta_por')
      .leftJoin('archivos as ar', 'ar.id', 'j.evidencia_id')
      .leftJoin('asistencia_estudiantes as a', 'a.id', 'j.asistencia_estudiante_id')
      .leftJoin('matriculas as m', 'm.id', 'a.matricula_id')
      .leftJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
      .leftJoin('jornadas_seccion as js', 'js.id', 'a.jornada_id')
      .leftJoin('sesiones_clase as sc', 'sc.id', 'a.sesion_id')
      .leftJoin('cursos_seccion as c', 'c.id', 'sc.curso_id')
      .leftJoin('asignaturas as asg', 'asg.id', 'c.asignatura_id')
      .leftJoin('asistencia_docentes as ad', 'ad.id', 'j.asistencia_docente_id')
      .leftJoin('jornadas_docente as jd', 'jd.id', 'ad.jornada_id')
      .leftJoin('docentes as d', 'd.id', 'jd.docente_id')
      .innerJoin('personas as pe', (join) => join.on(sql<boolean>`pe.id = coalesce(e.persona_id, d.persona_id)`));
    if (f.estado) q = q.where('j.estado', '=', f.estado);
    if (f.perfil === 'alumno') q = q.where('j.asistencia_estudiante_id', 'is not', null);
    if (f.perfil === 'docente') q = q.where('j.asistencia_docente_id', 'is not', null);
    if (f.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || coalesce(e.codigo, d.codigo)) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'j.id',
        sql<'alumno' | 'docente'>`case when j.asistencia_estudiante_id is not null then 'alumno' else 'docente' end`.as('perfil'),
        sql<string>`pe.apellidos || ', ' || pe.nombres`.as('persona'),
        sql<string>`coalesce(e.codigo, d.codigo)`.as('codigo'),
        sql<string>`coalesce(js.fecha, jd.fecha)::text`.as('fecha'),
        'asg.nombre as curso',
        sql<string>`coalesce(a.estado, ad.estado)`.as('estado_asistencia'),
        'j.motivo',
        'j.evidencia_id',
        'ar.nombre_original as evidencia_nombre',
        'j.estado',
        'j.solicitada_en',
        'us.login as solicitante',
        'j.resuelta_en',
        'ur.login as resolutor',
        'j.decision',
      ])
      .orderBy(sql`(j.estado = 'pendiente')`, 'desc')
      .orderBy('j.solicitada_en', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (x): FilaJustificacion => ({
        ...x,
        solicitada_en: x.solicitada_en.toISOString(),
        resuelta_en: x.resuelta_en ? x.resuelta_en.toISOString() : null,
      }),
    ),
    total: Number(total.n),
  };
}
