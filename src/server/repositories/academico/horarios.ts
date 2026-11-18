import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { BloqueHorario, FilaSesion } from '@/esquemas/academico/horarios';
import { ETIQUETA_SECCION, HOY_LIMA, NOMBRE_DOCENTE, vigencia } from './comunes';

// Horario semanal (vista horarios_seccion + bloques_horario) y sesiones de clase fechadas.

function consultaBloques() {
  return db()
    .selectFrom('horarios_seccion as h')
    .innerJoin('bloques_horario as b', 'b.id', 'h.id')
    .innerJoin('secciones as s', 's.id', 'b.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([
      'b.id',
      'b.seccion_id',
      ETIQUETA_SECCION.as('seccion'),
      'b.curso_id',
      'b.asignacion_id',
      'h.asignatura',
      'b.docente_id',
      'h.docente',
      'b.aula_id',
      'h.aula',
      'b.dia_iso',
      'b.hora_inicio',
      'b.hora_fin',
      'b.vigencia',
    ])
    .orderBy('b.dia_iso')
    .orderBy('b.hora_inicio');
}

type FilaConsultaBloque = Awaited<ReturnType<ReturnType<typeof consultaBloques>['execute']>>[number];

function aBloque(r: FilaConsultaBloque): BloqueHorario {
  const { vigencia: rangoTexto, ...resto } = r;
  return { ...resto, asignatura: resto.asignatura ?? '', docente: resto.docente ?? '', ...vigencia(rangoTexto) };
}

/** Bloques de la sección vigentes en la fecha (vista horarios_seccion). */
export async function bloquesDeSeccion(seccionId: string, fecha: string) {
  const filas = await consultaBloques()
    .where('b.seccion_id', '=', seccionId)
    .where(sql<boolean>`b.vigencia @> ${fecha}::date`)
    .execute();
  return filas.map(aBloque);
}

/** Bloques del docente vigentes en la fecha. */
export async function bloquesDeDocente(docenteId: string, fecha: string) {
  const filas = await consultaBloques()
    .where('b.docente_id', '=', docenteId)
    .where(sql<boolean>`b.vigencia @> ${fecha}::date`)
    .execute();
  return filas.map(aBloque);
}

export async function obtenerBloque(id: string) {
  return db()
    .selectFrom('bloques_horario')
    .select(['id', 'curso_id', 'asignacion_id', 'seccion_id', 'docente_id', 'aula_id', 'dia_iso', 'hora_inicio', 'hora_fin', 'vigencia'])
    .where('id', '=', id)
    .executeTakeFirst();
}

export interface ValoresBloque {
  cursoId: string;
  asignacionId: string;
  seccionId: string;
  docenteId: string;
  aulaId: string | null;
  diaIso: number;
  horaInicio: string;
  horaFin: string;
  vigencia: string;
}

export async function crearBloque(d: ValoresBloque) {
  return db()
    .insertInto('bloques_horario')
    .values({
      curso_id: d.cursoId,
      asignacion_id: d.asignacionId,
      seccion_id: d.seccionId,
      docente_id: d.docenteId,
      aula_id: d.aulaId,
      dia_iso: d.diaIso,
      hora_inicio: d.horaInicio,
      hora_fin: d.horaFin,
      vigencia: d.vigencia,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarBloque(id: string, d: Pick<ValoresBloque, 'aulaId' | 'diaIso' | 'horaInicio' | 'horaFin' | 'vigencia'>) {
  return db()
    .updateTable('bloques_horario')
    .set({ aula_id: d.aulaId, dia_iso: d.diaIso, hora_inicio: d.horaInicio, hora_fin: d.horaFin, vigencia: d.vigencia })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function eliminarBloque(id: string) {
  return db().deleteFrom('bloques_horario').where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function listarSesiones(
  f: { q?: string; anioId?: string; seccionId?: string; cursoId?: string; estado?: string; desde?: string; hasta?: string },
  p: Paginacion | null,
) {
  const base = () => {
    let q = db()
      .selectFrom('sesiones_clase as sc')
      .innerJoin('cursos_seccion as c', 'c.id', 'sc.curso_id')
      .innerJoin('asignaturas as x', 'x.id', 'c.asignatura_id')
      .innerJoin('secciones as s', 's.id', 'sc.seccion_id')
      .innerJoin('grados as g', 'g.id', 's.grado_id')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
      .innerJoin('docentes as d', 'd.id', 'sc.docente_id')
      .innerJoin('personas as pd', 'pd.id', 'd.persona_id')
      .leftJoin('aulas as au', 'au.id', 'sc.aula_id');
    if (f.anioId) q = q.where('s.anio_id', '=', f.anioId);
    if (f.seccionId) q = q.where('sc.seccion_id', '=', f.seccionId);
    if (f.cursoId) q = q.where('sc.curso_id', '=', f.cursoId);
    if (f.estado) q = q.where('sc.estado', '=', f.estado);
    if (f.desde) q = q.where('sc.fecha', '>=', f.desde);
    if (f.hasta) q = q.where('sc.fecha', '<=', f.hasta);
    if (f.q) q = q.where((eb) => eb.or([eb('x.nombre', 'ilike', `%${f.q}%`), eb(NOMBRE_DOCENTE, 'ilike', `%${f.q}%`)]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'sc.id',
        'sc.fecha',
        'sc.hora_inicio',
        'sc.hora_fin',
        'sc.estado',
        'sc.curso_id',
        'x.nombre as asignatura',
        'sc.seccion_id',
        ETIQUETA_SECCION.as('seccion'),
        NOMBRE_DOCENTE.as('docente'),
        'au.nombre as aula',
        'sc.bloque_id',
      ])
      .orderBy('sc.fecha')
      .orderBy('sc.hora_inicio')
      .orderBy('s.nombre'),
    p,
  ).execute();
  return { filas: filas as FilaSesion[], total: Number(total.n) };
}

export async function obtenerSesion(id: string) {
  return db().selectFrom('sesiones_clase').select(['id', 'estado', 'curso_id', 'seccion_id', 'docente_id', 'fecha']).where('id', '=', id).executeTakeFirst();
}

export interface ValoresSesion {
  cursoId: string;
  seccionId: string;
  bloqueId: string | null;
  asignacionId: string;
  docenteId: string;
  aulaId: string | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export async function crearSesion(d: ValoresSesion) {
  return db()
    .insertInto('sesiones_clase')
    .values({
      curso_id: d.cursoId,
      seccion_id: d.seccionId,
      bloque_id: d.bloqueId,
      asignacion_id: d.asignacionId,
      docente_id: d.docenteId,
      aula_id: d.aulaId,
      fecha: d.fecha,
      hora_inicio: d.horaInicio,
      hora_fin: d.horaFin,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function cambiarEstadoSesion(id: string, estado: string) {
  return db().updateTable('sesiones_clase').set({ estado }).where('id', '=', id).returning(['id', 'estado']).executeTakeFirst();
}

export interface CandidatoSesion {
  bloque_id: string;
  curso_id: string;
  asignacion_id: string;
  docente_id: string;
  seccion_id: string;
  aula_id: string | null;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
  asignatura: string;
  /** El calendario permite clases ese día. */
  lectivo: boolean;
  /** Ya existe una sesión del bloque en esa fecha. */
  existe: boolean;
}

/**
 * Fechas del rango en que aplica cada bloque de la sección (día ISO y vigencia del bloque).
 * Calendario: si el año tiene días lectivos registrados, solo valen esos; si no tiene calendario,
 * valen todos salvo los marcados como feriado o no lectivo.
 */
export async function candidatosSesiones(f: { seccionId: string; cursoId?: string; desde: string; hasta: string }) {
  const r = await sql<CandidatoSesion>`
    with dias as (
      select d::date as fecha from generate_series(${f.desde}::date, ${f.hasta}::date, interval '1 day') as d
    )
    select b.id as bloque_id, b.curso_id, b.asignacion_id, b.docente_id, b.seccion_id, b.aula_id,
           b.hora_inicio, b.hora_fin, dias.fecha, x.nombre as asignatura,
           coalesce(
             (select ce.tipo = 'lectivo' from calendario_escolar ce where ce.anio_id = s.anio_id and ce.fecha = dias.fecha),
             not exists (select 1 from calendario_escolar ce where ce.anio_id = s.anio_id and ce.tipo = 'lectivo')
           ) as lectivo,
           exists (select 1 from sesiones_clase sc where sc.bloque_id = b.id and sc.fecha = dias.fecha) as existe
    from bloques_horario b
    join secciones s on s.id = b.seccion_id
    join cursos_seccion c on c.id = b.curso_id
    join asignaturas x on x.id = c.asignatura_id
    join dias on extract(isodow from dias.fecha) = b.dia_iso and b.vigencia @> dias.fecha
    where b.seccion_id = ${f.seccionId}::bigint
      and (${f.cursoId ?? null}::bigint is null or b.curso_id = ${f.cursoId ?? null}::bigint)
    order by dias.fecha, b.hora_inicio`.execute(db());
  return r.rows;
}

/** Fecha de referencia de la sección: la indicada u hoy, acotada al año escolar. */
export async function fechaReferenciaSeccion(seccionId: string, fecha?: string) {
  const r = await db()
    .selectFrom('secciones as s')
    .innerJoin('anios_academicos as a', 'a.id', 's.anio_id')
    .select(sql<string>`least(greatest(coalesce(${fecha ?? null}::date, ${HOY_LIMA}), a.inicio), a.fin)`.as('fecha'))
    .where('s.id', '=', seccionId)
    .executeTakeFirst();
  return r?.fecha;
}

export async function etiquetaSeccion(seccionId: string) {
  const r = await db()
    .selectFrom('secciones as s')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([ETIQUETA_SECCION.as('etiqueta'), 's.turno', 's.anio_id'])
    .where('s.id', '=', seccionId)
    .executeTakeFirst();
  return r;
}

/**
 * Sección del estudiante en la fecha (matrícula no anulada). Si no hay una vigente ese día
 * (vacaciones), toma la ubicación más reciente y acota la fecha a su vigencia.
 */
export async function seccionDeEstudiante(estudianteId: string, fecha?: string) {
  const dia = fecha ? sql<string>`${fecha}::date` : HOY_LIMA;
  const vigente = await db()
    .selectFrom('matricula_secciones as ms')
    .innerJoin('matriculas as m', 'm.id', 'ms.matricula_id')
    .select(['ms.seccion_id', sql<string>`${dia}`.as('fecha')])
    .where('m.estudiante_id', '=', estudianteId)
    .where('m.estado', '<>', 'anulada')
    .where(sql<boolean>`ms.vigencia @> ${dia}`)
    .orderBy(sql`lower(ms.vigencia)`, 'desc')
    .executeTakeFirst();
  if (vigente) return vigente;
  return db()
    .selectFrom('matricula_secciones as ms')
    .innerJoin('matriculas as m', 'm.id', 'ms.matricula_id')
    .select(['ms.seccion_id', sql<string>`least(greatest(${dia}, lower(ms.vigencia)), upper(ms.vigencia) - 1)`.as('fecha')])
    .where('m.estudiante_id', '=', estudianteId)
    .where('m.estado', 'in', ['activa', 'solicitada'])
    .orderBy(sql`lower(ms.vigencia)`, 'desc')
    .executeTakeFirst();
}

/** Todas las asignaciones del docente (vigentes, pasadas y futuras) con su curso y sección. */
export async function asignacionesDeDocente(docenteId: string) {
  const filas = await db()
    .selectFrom('asignaciones_docentes as ad')
    .innerJoin('cursos_seccion as c', 'c.id', 'ad.curso_id')
    .innerJoin('asignaturas as x', 'x.id', 'c.asignatura_id')
    .innerJoin('secciones as s', 's.id', 'c.seccion_id')
    .innerJoin('anios_academicos as a', 'a.id', 's.anio_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select(['ad.id as asignacion_id', 'ad.funcion', 'ad.vigencia', 'c.id as curso_id', 'x.nombre as asignatura', ETIQUETA_SECCION.as('seccion'), 'a.anio'])
    .where('ad.docente_id', '=', docenteId)
    .orderBy('a.anio', 'desc')
    .orderBy(sql`lower(ad.vigencia)`, 'desc')
    .limit(200)
    .execute();
  return filas.map(({ vigencia: rangoTexto, ...r }) => ({ ...r, ...vigencia(rangoTexto) }));
}

/** Estudiantes ubicados en cada sección en la fecha. */
export async function alumnosPorSeccion(seccionIds: string[], fecha: string) {
  if (seccionIds.length === 0) return new Map<string, number>();
  const filas = await db()
    .selectFrom('matricula_secciones as ms')
    .innerJoin('matriculas as m', 'm.id', 'ms.matricula_id')
    .select(['ms.seccion_id', (eb) => eb.fn.countAll<string>().as('n')])
    .where('ms.seccion_id', 'in', seccionIds)
    .where('m.estado', '<>', 'anulada')
    .where(sql<boolean>`ms.vigencia @> ${fecha}::date`)
    .groupBy('ms.seccion_id')
    .execute();
  return new Map(filas.map((f) => [f.seccion_id, Number(f.n)]));
}

export async function hoyLima() {
  const r = await db().selectNoFrom(HOY_LIMA.as('hoy')).executeTakeFirstOrThrow();
  return r.hoy;
}
