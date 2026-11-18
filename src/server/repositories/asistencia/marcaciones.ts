import 'server-only';
import { db, sql } from '@/server/db';

// Repositorio: marcaciones (vía la función de la base `registrar_marcacion`) y asistencia diaria
// derivada de una marcación (alumno: jornada de su sección; docente: su jornada).

/** Marcación tal como la devuelve `registrar_marcacion`, con el instante en hora local de Lima (µs). */
export interface FilaMarcacion {
  id: string;
  evento_uuid: string;
  persona_id: string;
  instante: Date;
  /** 'YYYY-MM-DDTHH:MM:SS.ffffff' en America/Lima (misma precisión que compara la base). */
  instante_local: string;
  /** Fecha calendario en Lima del instante. */
  fecha_local: string;
  tipo: 'entrada' | 'salida';
  metodo: 'qr' | 'manual';
  lector_id: string | null;
  motivo: string | null;
}

const COLUMNAS = sql`m.id::text as id, m.evento_uuid::text as evento_uuid, m.persona_id::text as persona_id, m.instante,
  to_char(m.instante at time zone 'America/Lima', 'YYYY-MM-DD"T"HH24:MI:SS.US') as instante_local,
  (m.instante at time zone 'America/Lima')::date::text as fecha_local,
  m.tipo, m.metodo, m.lector_id::text as lector_id, m.motivo`;

/** Modo QR: la base resuelve persona (por hash) y hora (clock_timestamp), valida credencial y lector. */
export async function registrarMarcacionQr(e: { eventoUuid: string; tipo: string; actorId: string; tokenHash: Buffer; lectorId: string }) {
  const r = await sql<FilaMarcacion>`
    select ${COLUMNAS}
    from registrar_marcacion(${e.eventoUuid}::uuid, ${e.tipo}::text, ${e.actorId}::bigint, ${e.tokenHash}::bytea, ${e.lectorId}::bigint) m`.execute(db());
  const fila = r.rows[0];
  if (!fila) throw new Error('registrar_marcacion no devolvió la marcación');
  return fila;
}

/** Modo manual: persona, instante y motivo explícitos; sin lector ni credencial (lo exige la base). */
export async function registrarMarcacionManual(e: { eventoUuid: string; tipo: string; actorId: string; personaId: string; instante: string; motivo: string }) {
  const r = await sql<FilaMarcacion>`
    select ${COLUMNAS}
    from registrar_marcacion(${e.eventoUuid}::uuid, ${e.tipo}::text, ${e.actorId}::bigint, null::bytea, null::bigint,
                             ${e.personaId}::bigint, ${e.instante}::timestamptz, ${e.motivo}::text) m`.execute(db());
  const fila = r.rows[0];
  if (!fila) throw new Error('registrar_marcacion no devolvió la marcación');
  return fila;
}

export async function obtenerMarcacion(id: string) {
  const r = await sql<FilaMarcacion>`select ${COLUMNAS} from marcaciones m where m.id = ${id}::bigint`.execute(db());
  return r.rows[0];
}

export async function perfilesDePersona(personaId: string) {
  const persona = await db().selectFrom('personas').select(['id', 'nombres', 'apellidos']).where('id', '=', personaId).executeTakeFirst();
  const estudiante = await db().selectFrom('estudiantes').select(['id', 'codigo', 'activo']).where('persona_id', '=', personaId).executeTakeFirst();
  const docente = await db().selectFrom('docentes').select(['id', 'codigo', 'activo']).where('persona_id', '=', personaId).executeTakeFirst();
  return { persona, estudiante, docente };
}

/** Matrícula confirmada (no anulada) del estudiante ubicada en una sección vigente en la fecha. */
export async function matriculaEnFecha(estudianteId: string, fecha: string) {
  return db()
    .selectFrom('matriculas as m')
    .innerJoin('matricula_secciones as ms', 'ms.matricula_id', 'm.id')
    .innerJoin('secciones as s', 's.id', 'ms.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([
      'm.id as matricula_id',
      'ms.id as matricula_seccion_id',
      'ms.seccion_id',
      sql<string>`g.numero || '.º ' || s.nombre || ' ' || n.nombre`.as('seccion'),
    ])
    .where('m.estudiante_id', '=', estudianteId)
    .where('m.confirmada_en', 'is not', null)
    .where('m.estado', '<>', 'anulada')
    .where(sql<boolean>`ms.vigencia @> ${fecha}::date`)
    .orderBy('ms.id', 'desc')
    .executeTakeFirst();
}

const POLITICA = ['p.tolerancia_minutos', 'p.admite_qr', 'p.admite_manual', 'p.ventana_entrada_minutos', 'p.ventana_salida_minutos'] as const;

export async function jornadaSeccionEnFecha(seccionId: string, fecha: string) {
  return db()
    .selectFrom('jornadas_seccion as j')
    .innerJoin('politicas_asistencia as p', 'p.id', 'j.politica_id')
    .select(['j.id', 'j.fecha', 'j.entrada', 'j.salida', ...POLITICA])
    .where('j.seccion_id', '=', seccionId)
    .where('j.fecha', '=', fecha)
    .where('j.estado', '=', 'programada')
    .executeTakeFirst();
}

export async function jornadasDocenteEnFecha(docenteId: string, fecha: string) {
  return db()
    .selectFrom('jornadas_docente as j')
    .innerJoin('politicas_asistencia as p', 'p.id', 'j.politica_id')
    .leftJoin('asistencia_docentes as a', 'a.jornada_id', 'j.id')
    .select([
      'j.id',
      'j.fecha',
      'j.entrada',
      'j.salida',
      ...POLITICA,
      'a.id as asistencia_id',
      'a.estado as asistencia_estado',
      'a.entrada_id',
      'a.salida_id',
    ])
    .where('j.docente_id', '=', docenteId)
    .where('j.fecha', '=', fecha)
    .where('j.estado', '=', 'programada')
    .orderBy('j.entrada')
    .execute();
}

// ── Asistencia de alumnos ─────────────────────────────────────────────────────

export async function asistenciaDiariaAlumno(matriculaId: string, jornadaId: string) {
  return db()
    .selectFrom('asistencia_estudiantes')
    .select(['id', 'estado', 'entrada_id', 'salida_id'])
    .where('matricula_id', '=', matriculaId)
    .where('jornada_id', '=', jornadaId)
    .where('sesion_id', 'is', null)
    .executeTakeFirst();
}

export async function asistenciaSesionAlumno(matriculaId: string, sesionId: string) {
  return db()
    .selectFrom('asistencia_estudiantes')
    .select(['id', 'estado', 'entrada_id', 'salida_id'])
    .where('matricula_id', '=', matriculaId)
    .where('sesion_id', '=', sesionId)
    .executeTakeFirst();
}

export async function insertarAsistenciaAlumno(v: {
  matriculaId: string;
  matriculaSeccionId: string;
  jornadaId: string;
  sesionId?: string | null;
  estado: string;
  entradaId?: string | null;
  salidaId?: string | null;
  registradoPor: string;
  motivo: string;
}) {
  return db()
    .insertInto('asistencia_estudiantes')
    .values({
      matricula_id: v.matriculaId,
      matricula_seccion_id: v.matriculaSeccionId,
      jornada_id: v.jornadaId,
      sesion_id: v.sesionId ?? null,
      estado: v.estado,
      entrada_id: v.entradaId ?? null,
      salida_id: v.salidaId ?? null,
      registrado_por: v.registradoPor,
      motivo: v.motivo,
    })
    .returning(['id', 'estado'])
    .executeTakeFirstOrThrow();
}

export async function actualizarAsistenciaAlumno(
  id: string,
  v: { estado?: string; entradaId?: string; salidaId?: string; registradoPor: string; motivo: string },
) {
  return db()
    .updateTable('asistencia_estudiantes')
    .set({
      ...(v.estado !== undefined ? { estado: v.estado } : {}),
      ...(v.entradaId !== undefined ? { entrada_id: v.entradaId } : {}),
      ...(v.salidaId !== undefined ? { salida_id: v.salidaId } : {}),
      registrado_por: v.registradoPor,
      motivo: v.motivo,
    })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirstOrThrow();
}

// ── Asistencia de docentes ────────────────────────────────────────────────────

export async function asistenciaDocente(jornadaId: string) {
  return db().selectFrom('asistencia_docentes').select(['id', 'estado', 'entrada_id', 'salida_id']).where('jornada_id', '=', jornadaId).executeTakeFirst();
}

export async function insertarAsistenciaDocente(v: {
  jornadaId: string;
  estado: string;
  entradaId?: string | null;
  salidaId?: string | null;
  registradoPor: string;
  motivo: string;
}) {
  return db()
    .insertInto('asistencia_docentes')
    .values({
      jornada_id: v.jornadaId,
      estado: v.estado,
      entrada_id: v.entradaId ?? null,
      salida_id: v.salidaId ?? null,
      registrado_por: v.registradoPor,
      motivo: v.motivo,
    })
    .returning(['id', 'estado'])
    .executeTakeFirstOrThrow();
}

export async function actualizarAsistenciaDocente(
  id: string,
  v: { estado?: string; entradaId?: string; salidaId?: string; registradoPor: string; motivo: string },
) {
  return db()
    .updateTable('asistencia_docentes')
    .set({
      ...(v.estado !== undefined ? { estado: v.estado } : {}),
      ...(v.entradaId !== undefined ? { entrada_id: v.entradaId } : {}),
      ...(v.salidaId !== undefined ? { salida_id: v.salidaId } : {}),
      registrado_por: v.registradoPor,
      motivo: v.motivo,
    })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirstOrThrow();
}
