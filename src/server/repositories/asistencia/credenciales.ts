import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { EstadoCredencial, FilaCredencial, PersonaCredencial } from '@/esquemas/asistencia/credenciales';

// Repositorio: credenciales QR (solo hash SHA-256 del token), datos para carnets y búsquedas.

const ETIQUETA_SECCION = sql<string>`(g.numero || '.º ' || s.nombre || ' ' || n.nombre)`;

/** Sección vigente (hoy o la próxima) del alumno, como texto. */
const SECCION_ACTUAL = sql<string | null>`(
  select g.numero || '.º ' || s.nombre || ' ' || n.nombre
  from matriculas m
  join matricula_secciones ms on ms.matricula_id = m.id
  join secciones s on s.id = ms.seccion_id
  join grados g on g.id = s.grado_id
  join niveles n on n.id = g.nivel_id
  where m.estudiante_id = e.id and m.confirmada_en is not null and m.estado <> 'anulada'
    and ms.vigencia && daterange((now() at time zone 'America/Lima')::date, null, '[)')
  order by lower(ms.vigencia) limit 1)`;

export async function buscarPersonas(q: string, perfil?: 'alumno' | 'docente'): Promise<PersonaCredencial[]> {
  const patron = `%${q}%`;
  const vigente = (alias: string) =>
    sql<boolean>`exists (select 1 from credenciales_qr c where c.persona_id = ${sql.ref(`${alias}.persona_id`)}
      and c.revocada_en is null and c.expira_en > now())`;
  const alumnos =
    perfil === 'docente'
      ? []
      : await db()
          .selectFrom('estudiantes as e')
          .innerJoin('personas as p', 'p.id', 'e.persona_id')
          .select([
            'e.persona_id',
            sql<string>`p.apellidos || ', ' || p.nombres`.as('nombre'),
            'e.codigo',
            SECCION_ACTUAL.as('detalle'),
            vigente('e').as('credencial_vigente'),
          ])
          .where('e.activo', '=', true)
          .where(sql<boolean>`(p.apellidos || ' ' || p.nombres || ' ' || e.codigo) ilike ${patron}`)
          .orderBy('p.apellidos')
          .orderBy('p.nombres')
          .limit(25)
          .execute();
  const docentes =
    perfil === 'alumno'
      ? []
      : await db()
          .selectFrom('docentes as d')
          .innerJoin('personas as p', 'p.id', 'd.persona_id')
          .select(['d.persona_id', sql<string>`p.apellidos || ', ' || p.nombres`.as('nombre'), 'd.codigo', vigente('d').as('credencial_vigente')])
          .where('d.activo', '=', true)
          .where(sql<boolean>`(p.apellidos || ' ' || p.nombres || ' ' || d.codigo) ilike ${patron}`)
          .orderBy('p.apellidos')
          .orderBy('p.nombres')
          .limit(25)
          .execute();
  return [
    ...alumnos.map((a) => ({ ...a, perfil: 'alumno' as const })),
    ...docentes.map((d) => ({ ...d, detalle: 'Docente', perfil: 'docente' as const })),
  ];
}

/** Alumnos activos con matrícula confirmada en la sección, vigente hoy o que empieza después. */
export async function personasDeSeccion(seccionId: string): Promise<string[]> {
  const filas = await db()
    .selectFrom('matricula_secciones as ms')
    .innerJoin('matriculas as m', 'm.id', 'ms.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select(['e.persona_id'])
    .distinct()
    .where('ms.seccion_id', '=', seccionId)
    .where('m.confirmada_en', 'is not', null)
    .where('m.estado', '<>', 'anulada')
    .where('e.activo', '=', true)
    .where(sql<boolean>`ms.vigencia && daterange((now() at time zone 'America/Lima')::date, null, '[)')`)
    .execute();
  return filas.map((f) => f.persona_id);
}

export async function personasDeDocentes(docenteIds: string[]): Promise<string[]> {
  let q = db().selectFrom('docentes').select('persona_id').where('activo', '=', true);
  if (docenteIds.length > 0) q = q.where('id', 'in', docenteIds);
  return (await q.execute()).map((f) => f.persona_id);
}

export interface DatosCarnet {
  persona_id: string;
  nombres: string;
  apellidos: string;
  perfil: 'alumno' | 'docente';
  codigo: string;
  detalle: string | null;
}

/** Datos impresos en el carnet. Solo personas con perfil ACTIVO de alumno o docente (lo exige la marcación). */
export async function datosCarnet(personaIds: string[]): Promise<DatosCarnet[]> {
  if (personaIds.length === 0) return [];
  const alumnos = await db()
    .selectFrom('estudiantes as e')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select(['e.persona_id', 'p.nombres', 'p.apellidos', 'e.codigo', SECCION_ACTUAL.as('detalle')])
    .where('e.persona_id', 'in', personaIds)
    .where('e.activo', '=', true)
    .execute();
  const conAlumno = new Set(alumnos.map((a) => a.persona_id));
  const docentes = await db()
    .selectFrom('docentes as d')
    .innerJoin('personas as p', 'p.id', 'd.persona_id')
    .select(['d.persona_id', 'p.nombres', 'p.apellidos', 'd.codigo'])
    .where('d.persona_id', 'in', personaIds)
    .where('d.activo', '=', true)
    .execute();
  const lista: DatosCarnet[] = [
    ...alumnos.map((a) => ({ ...a, perfil: 'alumno' as const })),
    ...docentes.filter((d) => !conAlumno.has(d.persona_id)).map((d) => ({ ...d, detalle: 'Docente', perfil: 'docente' as const })),
  ];
  return lista.sort((a, b) => (a.detalle ?? '').localeCompare(b.detalle ?? '', 'es') || a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es'));
}

/** Revoca las credenciales aún utilizables de las personas (reemisión = revoca la anterior). */
export async function revocarVigentesDe(personaIds: string[], actorId: string): Promise<number> {
  if (personaIds.length === 0) return 0;
  const r = await db()
    .updateTable('credenciales_qr')
    .set({ revocada_en: sql`clock_timestamp()`, revocada_por: actorId })
    .where('persona_id', 'in', personaIds)
    .where('revocada_en', 'is', null)
    .where('expira_en', '>', sql<Date>`now()`)
    .returning(['id'])
    .execute();
  return r.length;
}

/** Inserta la credencial con el HASH del token. Vence al terminar el día `expiraEn` (hora de Lima). */
export async function insertarCredencial(e: { personaId: string; tokenHash: Buffer; emitidaPor: string; expiraEn: string }) {
  return db()
    .insertInto('credenciales_qr')
    .values({
      persona_id: e.personaId,
      token_hash: e.tokenHash,
      emitida_por: e.emitidaPor,
      expira_en: sql<Date>`((${e.expiraEn}::date + 1)::timestamp at time zone 'America/Lima')`,
    })
    .returning(['id', 'expira_en'])
    .executeTakeFirstOrThrow();
}

export async function revocarCredencial(id: string, actorId: string) {
  return db()
    .updateTable('credenciales_qr')
    .set({ revocada_en: sql`clock_timestamp()`, revocada_por: actorId })
    .where('id', '=', id)
    .where('revocada_en', 'is', null)
    .returning(['id', 'persona_id'])
    .executeTakeFirst();
}

export async function obtenerCredencial(id: string) {
  return db().selectFrom('credenciales_qr').select(['id', 'persona_id', 'revocada_en', 'expira_en']).where('id', '=', id).executeTakeFirst();
}

/**
 * Credencial para una lectura capturada SIN conexión: el hash debe corresponder a una credencial
 * no revocada y vigente en el instante capturado (emitida antes y aún no vencida).
 */
export async function credencialVigenteEn(tokenHash: Buffer, instante: string) {
  return db()
    .selectFrom('credenciales_qr')
    .select(['id', 'persona_id'])
    .where('token_hash', '=', tokenHash)
    .where('revocada_en', 'is', null)
    .where('emitida_en', '<=', sql<Date>`${instante}::timestamptz`)
    .where('expira_en', '>', sql<Date>`${instante}::timestamptz`)
    .executeTakeFirst();
}

const ESTADO = sql<EstadoCredencial>`case when c.revocada_en is not null then 'revocada' when c.expira_en <= now() then 'vencida' else 'vigente' end`;

export async function listarCredenciales(f: { q?: string; estado?: EstadoCredencial; perfil?: 'alumno' | 'docente' }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('credenciales_qr as c')
      .innerJoin('personas as p', 'p.id', 'c.persona_id')
      .innerJoin('usuarios as u', 'u.id', 'c.emitida_por')
      .leftJoin('estudiantes as e', 'e.persona_id', 'c.persona_id')
      .leftJoin('docentes as d', 'd.persona_id', 'c.persona_id');
    if (f.estado === 'revocada') q = q.where('c.revocada_en', 'is not', null);
    if (f.estado === 'vencida') q = q.where('c.revocada_en', 'is', null).where('c.expira_en', '<=', sql<Date>`now()`);
    if (f.estado === 'vigente') q = q.where('c.revocada_en', 'is', null).where('c.expira_en', '>', sql<Date>`now()`);
    if (f.perfil === 'alumno') q = q.where('e.id', 'is not', null);
    if (f.perfil === 'docente') q = q.where('d.id', 'is not', null).where('e.id', 'is', null);
    if (f.q) q = q.where(sql<boolean>`(p.apellidos || ' ' || p.nombres || ' ' || coalesce(e.codigo, '') || ' ' || coalesce(d.codigo, '')) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'c.id',
        'c.persona_id',
        sql<string>`p.apellidos || ', ' || p.nombres`.as('persona'),
        sql<string>`case when e.id is not null then 'Alumno' when d.id is not null then 'Docente' else '—' end`.as('perfil'),
        sql<string | null>`coalesce(e.codigo, d.codigo)`.as('codigo'),
        'c.emitida_en',
        'c.expira_en',
        'c.revocada_en',
        'u.login as emitida_por',
        ESTADO.as('estado'),
      ])
      .orderBy('c.emitida_en', 'desc')
      .orderBy('c.id', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (x): FilaCredencial => ({
        ...x,
        emitida_en: x.emitida_en.toISOString(),
        expira_en: x.expira_en.toISOString(),
        revocada_en: x.revocada_en ? x.revocada_en.toISOString() : null,
      }),
    ),
    total: Number(total.n),
  };
}

export async function etiquetaSeccion(seccionId: string) {
  const f = await db()
    .selectFrom('secciones as s')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([ETIQUETA_SECCION.as('etiqueta'), 's.anio_id'])
    .where('s.id', '=', seccionId)
    .executeTakeFirst();
  return f;
}
