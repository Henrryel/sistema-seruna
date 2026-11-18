import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type {
  EstadoAsistencia,
  FilaAsistenciaAlumno,
  FilaAsistenciaDocente,
  FilaDetalleAsistencia,
  FilaJustificacionPropia,
  FilaSesion,
  JornadaSeccionInfo,
  SesionInfo,
} from '@/esquemas/asistencia/registro';

// Repositorio: consultas de asistencia diaria (vistas asistencia_diaria_estudiantes / _docentes),
// por sesión de clase y resúmenes para portales.

const ETIQUETA_SECCION = sql<string>`(g.numero || '.º ' || s.nombre || ' ' || n.nombre)`;
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Última justificación (la vigente o la más reciente) de una asistencia de alumno. */
const JUST_ALUMNO = (col: string) =>
  sql<string | null>`(select j.estado from justificaciones_asistencia j where j.asistencia_estudiante_id = ${sql.ref(col)}
    order by (j.estado <> 'rechazada') desc, j.solicitada_en desc limit 1)`;
const JUST_DOCENTE = (col: string) =>
  sql<string | null>`(select j.estado from justificaciones_asistencia j where j.asistencia_docente_id = ${sql.ref(col)}
    order by (j.estado <> 'rechazada') desc, j.solicitada_en desc limit 1)`;

// ── Jornada de sección ────────────────────────────────────────────────────────

export async function jornadaDeSeccion(seccionId: string, fecha: string): Promise<JornadaSeccionInfo | undefined> {
  return db()
    .selectFrom('jornadas_seccion as j')
    .innerJoin('politicas_asistencia as p', 'p.id', 'j.politica_id')
    .innerJoin('secciones as s', 's.id', 'j.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select(['j.id', 'j.fecha', 'j.entrada', 'j.salida', ETIQUETA_SECCION.as('seccion'), 'p.admite_qr', 'p.admite_manual', 'p.tolerancia_minutos'])
    .where('j.seccion_id', '=', seccionId)
    .where('j.fecha', '=', fecha)
    .where('j.estado', '=', 'programada')
    .executeTakeFirst();
}

export async function obtenerJornadaSeccion(id: string) {
  return db().selectFrom('jornadas_seccion').select(['id', 'seccion_id', 'fecha', 'estado']).where('id', '=', id).executeTakeFirst();
}

export async function obtenerJornadaDocente(id: string) {
  return db().selectFrom('jornadas_docente').select(['id', 'docente_id', 'fecha', 'estado']).where('id', '=', id).executeTakeFirst();
}

/** Ubicación de la matrícula (confirmada, no anulada) en la sección de la jornada, vigente en su fecha. */
export async function matriculaSeccionEnJornada(matriculaId: string, jornadaId: string) {
  return db()
    .selectFrom('jornadas_seccion as j')
    .innerJoin('matricula_secciones as ms', (join) => join.onRef('ms.seccion_id', '=', 'j.seccion_id').on(sql<boolean>`ms.vigencia @> j.fecha`))
    .innerJoin('matriculas as m', 'm.id', 'ms.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select(['ms.id as matricula_seccion_id', sql<string>`p.apellidos || ', ' || p.nombres`.as('estudiante')])
    .where('j.id', '=', jornadaId)
    .where('ms.matricula_id', '=', matriculaId)
    .where('m.confirmada_en', 'is not', null)
    .where('m.estado', '<>', 'anulada')
    .executeTakeFirst();
}

/** Nómina esperada de la jornada (vista de la base) con su estado diario. */
export async function listarDiariaSeccion(f: { seccionId: string; fecha: string; q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('asistencia_diaria_estudiantes as v')
      .innerJoin('estudiantes as e', 'e.id', 'v.estudiante_id')
      .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
      .leftJoin('asistencia_estudiantes as a', 'a.id', 'v.asistencia_id')
      .where('v.seccion_id', '=', f.seccionId)
      .where('v.fecha', '=', f.fecha);
    if (f.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || e.codigo) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'v.matricula_id',
        'v.estudiante_id',
        'e.codigo',
        sql<string>`pe.apellidos || ', ' || pe.nombres`.as('estudiante'),
        'v.asistencia_id',
        'v.estado',
        'v.entrada',
        'v.salida',
        'a.motivo',
        JUST_ALUMNO('v.asistencia_id').as('justificacion'),
      ])
      .orderBy('pe.apellidos')
      .orderBy('pe.nombres'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (x): FilaAsistenciaAlumno => ({
        matricula_id: String(x.matricula_id),
        estudiante_id: String(x.estudiante_id),
        codigo: x.codigo,
        estudiante: x.estudiante,
        asistencia_id: x.asistencia_id,
        estado: (x.estado ?? 'pendiente') as EstadoAsistencia,
        entrada: iso(x.entrada),
        salida: iso(x.salida),
        motivo: x.motivo,
        justificacion: x.justificacion,
      }),
    ),
    total: Number(total.n),
  };
}

// ── Sesiones de clase ─────────────────────────────────────────────────────────

const consultaSesiones = () =>
  db()
    .selectFrom('sesiones_clase as sc')
    .innerJoin('cursos_seccion as c', 'c.id', 'sc.curso_id')
    .innerJoin('asignaturas as asg', 'asg.id', 'c.asignatura_id')
    .innerJoin('secciones as s', 's.id', 'sc.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('docentes as d', 'd.id', 'sc.docente_id')
    .innerJoin('personas as pd', 'pd.id', 'd.persona_id');

const columnasSesion = [
  'sc.id',
  'sc.fecha',
  'sc.hora_inicio',
  'sc.hora_fin',
  'sc.estado',
  'asg.nombre as curso',
  ETIQUETA_SECCION.as('seccion'),
  sql<string>`pd.apellidos || ', ' || pd.nombres`.as('docente'),
  sql<string>`(select count(*) from asistencia_estudiantes a where a.sesion_id = sc.id)`.as('registrados'),
] as const;

export async function listarSesiones(f: { fecha: string; seccionId?: string; docenteId?: string }): Promise<FilaSesion[]> {
  let q = consultaSesiones().select(columnasSesion).where('sc.fecha', '=', f.fecha).where('sc.estado', '<>', 'cancelada');
  if (f.seccionId) q = q.where('sc.seccion_id', '=', f.seccionId);
  if (f.docenteId) q = q.where('sc.docente_id', '=', f.docenteId);
  const filas = await q.orderBy('sc.hora_inicio').orderBy('s.nombre').execute();
  return filas.map((x) => ({ ...x, registrados: Number(x.registrados ?? 0) }));
}

export async function obtenerSesion(id: string): Promise<(SesionInfo & { docente_id: string }) | undefined> {
  const x = await consultaSesiones()
    .leftJoin('jornadas_seccion as j', (join) =>
      join.onRef('j.seccion_id', '=', 'sc.seccion_id').onRef('j.fecha', '=', 'sc.fecha').on('j.estado', '=', 'programada'),
    )
    .leftJoin('politicas_asistencia as p', 'p.id', 'j.politica_id')
    .select([...columnasSesion, 'sc.seccion_id', 'sc.docente_id', 'j.id as jornada_id', 'p.admite_manual'])
    .where('sc.id', '=', id)
    .executeTakeFirst();
  if (!x) return undefined;
  return { ...x, registrados: Number(x.registrados ?? 0), jornada_id: x.jornada_id, admite_manual: Boolean(x.admite_manual) };
}

/** Nómina de la sesión: alumnos esperados en la jornada de su sección ese día + su asistencia a la sesión. */
export async function listarAsistenciaSesion(f: { sesionId: string; jornadaId: string; q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('asistencia_diaria_estudiantes as v')
      .innerJoin('estudiantes as e', 'e.id', 'v.estudiante_id')
      .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
      .leftJoin('asistencia_estudiantes as a', (join) =>
        join.onRef('a.matricula_id', '=', 'v.matricula_id').on('a.sesion_id', '=', f.sesionId),
      )
      .where('v.jornada_id', '=', f.jornadaId);
    if (f.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || e.codigo) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'v.matricula_id',
        'v.estudiante_id',
        'e.codigo',
        sql<string>`pe.apellidos || ', ' || pe.nombres`.as('estudiante'),
        'a.id as asistencia_id',
        sql<string>`coalesce(a.estado, 'pendiente')`.as('estado'),
        'a.motivo',
        JUST_ALUMNO('a.id').as('justificacion'),
      ])
      .orderBy('pe.apellidos')
      .orderBy('pe.nombres'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (x): FilaAsistenciaAlumno => ({
        matricula_id: String(x.matricula_id),
        estudiante_id: String(x.estudiante_id),
        codigo: x.codigo,
        estudiante: x.estudiante,
        asistencia_id: x.asistencia_id,
        estado: x.estado as EstadoAsistencia,
        entrada: null,
        salida: null,
        motivo: x.motivo,
        justificacion: x.justificacion,
      }),
    ),
    total: Number(total.n),
  };
}

// ── Docentes ──────────────────────────────────────────────────────────────────

export async function listarDiariaDocentes(f: { fecha?: string; desde?: string; hasta?: string; estado?: string; q?: string; docenteId?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('asistencia_diaria_docentes as v')
      .innerJoin('jornadas_docente as j', 'j.id', 'v.jornada_id')
      .innerJoin('docentes as d', 'd.id', 'v.docente_id')
      .innerJoin('personas as pe', 'pe.id', 'd.persona_id')
      .leftJoin('asistencia_docentes as a', 'a.id', 'v.asistencia_id');
    if (f.fecha) q = q.where('v.fecha', '=', f.fecha);
    if (f.desde) q = q.where('v.fecha', '>=', f.desde);
    if (f.hasta) q = q.where('v.fecha', '<=', f.hasta);
    if (f.estado) q = q.where('v.estado', '=', f.estado);
    if (f.docenteId) q = q.where('v.docente_id', '=', f.docenteId);
    if (f.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || d.codigo) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'v.jornada_id',
        'v.docente_id',
        'v.fecha',
        'd.codigo',
        sql<string>`pe.apellidos || ', ' || pe.nombres`.as('docente'),
        'j.entrada as hora_entrada',
        'j.salida as hora_salida',
        'v.asistencia_id',
        'v.estado',
        'v.entrada',
        'v.salida',
        'a.motivo',
        JUST_DOCENTE('v.asistencia_id').as('justificacion'),
      ])
      .orderBy('v.fecha', 'desc')
      .orderBy('pe.apellidos')
      .orderBy('j.entrada'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (x): FilaAsistenciaDocente & { fecha: string } => ({
        jornada_id: String(x.jornada_id),
        docente_id: String(x.docente_id),
        fecha: String(x.fecha),
        codigo: x.codigo,
        docente: x.docente,
        hora_entrada: x.hora_entrada,
        hora_salida: x.hora_salida,
        asistencia_id: x.asistencia_id,
        estado: (x.estado ?? 'pendiente') as EstadoAsistencia,
        entrada: iso(x.entrada),
        salida: iso(x.salida),
        motivo: x.motivo,
        justificacion: x.justificacion,
      }),
    ),
    total: Number(total.n),
  };
}

// ── Resúmenes para portales ───────────────────────────────────────────────────

const JUSTIFICABLE = (estadoCol: string, idCol: string, columna: 'asistencia_estudiante_id' | 'asistencia_docente_id') =>
  sql<boolean>`(${sql.ref(estadoCol)} in ('ausente', 'tarde') and ${sql.ref(idCol)} is not null and not exists (
    select 1 from justificaciones_asistencia j where j.${sql.raw(columna)} = ${sql.ref(idCol)} and j.estado in ('pendiente', 'aprobada')))`;

export async function detalleDiarioAlumno(estudianteId: string, f: { desde?: string; hasta: string }): Promise<FilaDetalleAsistencia[]> {
  let q = db()
    .selectFrom('asistencia_diaria_estudiantes as v')
    .select([
      'v.asistencia_id',
      'v.fecha',
      'v.estado',
      'v.entrada',
      'v.salida',
      JUST_ALUMNO('v.asistencia_id').as('justificacion_estado'),
      JUSTIFICABLE('v.estado', 'v.asistencia_id', 'asistencia_estudiante_id').as('justificable'),
    ])
    .where('v.estudiante_id', '=', estudianteId)
    .where('v.fecha', '<=', f.hasta);
  if (f.desde) q = q.where('v.fecha', '>=', f.desde);
  const filas = await q.orderBy('v.fecha', 'desc').limit(400).execute();
  return filas.map((x) => ({
    asistencia_id: x.asistencia_id,
    fecha: String(x.fecha),
    estado: (x.estado ?? 'pendiente') as EstadoAsistencia,
    entrada: iso(x.entrada),
    salida: iso(x.salida),
    curso: null,
    hora_inicio: null,
    justificacion_estado: x.justificacion_estado,
    justificable: Boolean(x.justificable),
  }));
}

export async function detalleSesionesAlumno(estudianteId: string, f: { desde?: string; hasta: string }): Promise<FilaDetalleAsistencia[]> {
  let q = db()
    .selectFrom('asistencia_estudiantes as a')
    .innerJoin('matriculas as m', 'm.id', 'a.matricula_id')
    .innerJoin('sesiones_clase as sc', 'sc.id', 'a.sesion_id')
    .innerJoin('cursos_seccion as c', 'c.id', 'sc.curso_id')
    .innerJoin('asignaturas as asg', 'asg.id', 'c.asignatura_id')
    .select([
      'a.id as asistencia_id',
      'sc.fecha',
      'a.estado',
      'asg.nombre as curso',
      'sc.hora_inicio',
      JUST_ALUMNO('a.id').as('justificacion_estado'),
      JUSTIFICABLE('a.estado', 'a.id', 'asistencia_estudiante_id').as('justificable'),
    ])
    .where('m.estudiante_id', '=', estudianteId)
    .where('sc.fecha', '<=', f.hasta);
  if (f.desde) q = q.where('sc.fecha', '>=', f.desde);
  const filas = await q.orderBy('sc.fecha', 'desc').orderBy('sc.hora_inicio', 'desc').limit(400).execute();
  return filas.map((x) => ({
    asistencia_id: x.asistencia_id,
    fecha: x.fecha,
    estado: x.estado as EstadoAsistencia,
    entrada: null,
    salida: null,
    curso: x.curso,
    hora_inicio: x.hora_inicio,
    justificacion_estado: x.justificacion_estado,
    justificable: Boolean(x.justificable),
  }));
}

export async function detalleDocente(docenteId: string, f: { desde?: string; hasta: string }): Promise<FilaDetalleAsistencia[]> {
  let q = db()
    .selectFrom('asistencia_diaria_docentes as v')
    .innerJoin('jornadas_docente as j', 'j.id', 'v.jornada_id')
    .select([
      'v.asistencia_id',
      'v.fecha',
      'v.estado',
      'v.entrada',
      'v.salida',
      'j.entrada as hora_inicio',
      JUST_DOCENTE('v.asistencia_id').as('justificacion_estado'),
      JUSTIFICABLE('v.estado', 'v.asistencia_id', 'asistencia_docente_id').as('justificable'),
    ])
    .where('v.docente_id', '=', docenteId)
    .where('v.fecha', '<=', f.hasta);
  if (f.desde) q = q.where('v.fecha', '>=', f.desde);
  const filas = await q.orderBy('v.fecha', 'desc').orderBy('j.entrada', 'desc').limit(400).execute();
  return filas.map((x) => ({
    asistencia_id: x.asistencia_id,
    fecha: String(x.fecha),
    estado: (x.estado ?? 'pendiente') as EstadoAsistencia,
    entrada: iso(x.entrada),
    salida: iso(x.salida),
    curso: null,
    hora_inicio: x.hora_inicio,
    justificacion_estado: x.justificacion_estado,
    justificable: Boolean(x.justificable),
  }));
}

const columnasJustificacionPropia = [
  'j.id',
  'j.motivo',
  'j.estado',
  'j.solicitada_en',
  'j.decision',
  'j.resuelta_en',
  sql<boolean>`j.evidencia_id is not null`.as('tiene_evidencia'),
  sql<string>`(select p.nombres || ' ' || p.apellidos from personas p where p.id = us.persona_id)`.as('solicitante'),
] as const;

export async function justificacionesDeEstudiante(estudianteId: string): Promise<FilaJustificacionPropia[]> {
  const filas = await db()
    .selectFrom('justificaciones_asistencia as j')
    .innerJoin('asistencia_estudiantes as a', 'a.id', 'j.asistencia_estudiante_id')
    .innerJoin('matriculas as m', 'm.id', 'a.matricula_id')
    .innerJoin('jornadas_seccion as js', 'js.id', 'a.jornada_id')
    .innerJoin('usuarios as us', 'us.id', 'j.solicitada_por')
    .leftJoin('sesiones_clase as sc', 'sc.id', 'a.sesion_id')
    .leftJoin('cursos_seccion as c', 'c.id', 'sc.curso_id')
    .leftJoin('asignaturas as asg', 'asg.id', 'c.asignatura_id')
    .select([...columnasJustificacionPropia, 'js.fecha', 'a.estado as estado_asistencia', 'asg.nombre as curso'])
    .where('m.estudiante_id', '=', estudianteId)
    .orderBy('j.solicitada_en', 'desc')
    .limit(200)
    .execute();
  return filas.map((x) => ({ ...x, solicitada_en: x.solicitada_en.toISOString(), resuelta_en: iso(x.resuelta_en), tiene_evidencia: Boolean(x.tiene_evidencia) }));
}

export async function justificacionesDeDocente(docenteId: string): Promise<FilaJustificacionPropia[]> {
  const filas = await db()
    .selectFrom('justificaciones_asistencia as j')
    .innerJoin('asistencia_docentes as a', 'a.id', 'j.asistencia_docente_id')
    .innerJoin('jornadas_docente as jd', 'jd.id', 'a.jornada_id')
    .innerJoin('usuarios as us', 'us.id', 'j.solicitada_por')
    .select([...columnasJustificacionPropia, 'jd.fecha', 'a.estado as estado_asistencia', sql<string | null>`null`.as('curso')])
    .where('jd.docente_id', '=', docenteId)
    .orderBy('j.solicitada_en', 'desc')
    .limit(200)
    .execute();
  return filas.map((x) => ({ ...x, solicitada_en: x.solicitada_en.toISOString(), resuelta_en: iso(x.resuelta_en), tiene_evidencia: Boolean(x.tiene_evidencia) }));
}
