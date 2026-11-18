import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import { leerRangoFechas, rangoFechas } from '@/lib/formato';
import type {
  AlcancePolitica,
  DatosLector,
  DatosPolitica,
  FilaJornada,
  FilaLector,
  FilaPolitica,
  OpcionesGeneracion,
  TipoJornada,
} from '@/esquemas/asistencia/configuracion';

// Repositorio: políticas de asistencia, jornadas (sección/docente), calendario lectivo y lectores QR.

const ETIQUETA_SECCION = sql<string>`(g.numero || '.º ' || s.nombre || ' ' || n.nombre)`;

// ── Políticas ─────────────────────────────────────────────────────────────────

export async function listarPoliticas(f: { q?: string; anioId?: string; alcance?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('politicas_asistencia as p').innerJoin('anios_academicos as a', 'a.id', 'p.anio_id');
    if (f.anioId) q = q.where('p.anio_id', '=', f.anioId);
    if (f.alcance) q = q.where('p.alcance', '=', f.alcance);
    if (f.q) q = q.where('p.turno', 'ilike', `%${f.q}%`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'p.id',
        'p.anio_id',
        'a.anio',
        'p.alcance',
        'p.turno',
        sql<string>`p.vigencia::text`.as('vigencia'),
        'p.admite_qr',
        'p.admite_manual',
        'p.tolerancia_minutos',
        'p.ventana_entrada_minutos',
        'p.ventana_salida_minutos',
        sql<string>`(select count(*) from jornadas_seccion j where j.politica_id = p.id) + (select count(*) from jornadas_docente j where j.politica_id = p.id)`.as(
          'jornadas',
        ),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy('p.alcance')
      .orderBy('p.turno')
      .orderBy(sql`lower(p.vigencia)`),
    p,
  ).execute();
  return {
    filas: filas.map((x): FilaPolitica => {
      const r = leerRangoFechas(x.vigencia);
      return {
        id: x.id,
        anio_id: x.anio_id,
        anio: x.anio,
        alcance: x.alcance as AlcancePolitica,
        turno: x.turno,
        vigencia_inicio: r.inicio,
        vigencia_fin: r.fin,
        admite_qr: x.admite_qr,
        admite_manual: x.admite_manual,
        tolerancia_minutos: x.tolerancia_minutos,
        ventana_entrada_minutos: x.ventana_entrada_minutos,
        ventana_salida_minutos: x.ventana_salida_minutos,
        jornadas: Number(x.jornadas ?? 0),
      };
    }),
    total: Number(total.n),
  };
}

export async function obtenerPolitica(id: string) {
  const p = await db()
    .selectFrom('politicas_asistencia as p')
    .innerJoin('anios_academicos as a', 'a.id', 'p.anio_id')
    .select([
      'p.id',
      'p.anio_id',
      'p.alcance',
      'p.turno',
      sql<string>`p.vigencia::text`.as('vigencia'),
      'p.admite_qr',
      'p.admite_manual',
      'p.tolerancia_minutos',
      'a.inicio as anio_inicio',
      'a.fin as anio_fin',
    ])
    .where('p.id', '=', id)
    .executeTakeFirst();
  if (!p) return undefined;
  const r = leerRangoFechas(p.vigencia);
  return { ...p, vigencia_inicio: r.inicio, vigencia_fin: r.fin };
}

function valoresPolitica(d: DatosPolitica) {
  return {
    anio_id: d.anioId,
    alcance: d.alcance,
    turno: d.turno,
    vigencia: rangoFechas(d.vigenciaInicio, d.vigenciaFin),
    admite_qr: d.admiteQr,
    admite_manual: d.admiteManual,
    tolerancia_minutos: d.toleranciaMinutos,
    ventana_entrada_minutos: d.ventanaEntradaMinutos,
    ventana_salida_minutos: d.ventanaSalidaMinutos,
  };
}

export async function crearPolitica(d: DatosPolitica) {
  return db().insertInto('politicas_asistencia').values(valoresPolitica(d)).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarPolitica(id: string, d: DatosPolitica) {
  return db().updateTable('politicas_asistencia').set(valoresPolitica(d)).where('id', '=', id).returning(['id']).executeTakeFirst();
}

// ── Jornadas ──────────────────────────────────────────────────────────────────

/**
 * Fechas en las que se generan jornadas dentro de [desde, hasta], recortadas al año académico y a la
 * vigencia de la política. Si el año tiene días `lectivo` en `calendario_escolar`, se usan solo esos;
 * si no, lunes a viernes excepto los días marcados `feriado` o `no_lectivo`.
 */
export async function fechasParaJornadas(politicaId: string, desde: string, hasta: string) {
  const usaCalendario = await sql<{ si: boolean }>`
    select exists (select 1 from calendario_escolar c join politicas_asistencia p on p.anio_id = c.anio_id
                   where p.id = ${politicaId}::bigint and c.tipo = 'lectivo') as si`.execute(db());
  const calendario = Boolean(usaCalendario.rows[0]?.si);
  const r = await sql<{ fecha: string }>`
    with pol as (
      select p.anio_id, p.vigencia, a.inicio, a.fin, ${calendario}::boolean as calendario
      from politicas_asistencia p join anios_academicos a on a.id = p.anio_id
      where p.id = ${politicaId}::bigint
    )
    select d::date::text as fecha
    from pol, generate_series(${desde}::date, ${hasta}::date, interval '1 day') as d
    where d::date between pol.inicio and pol.fin
      and pol.vigencia @> d::date
      and case
            when pol.calendario then exists (
              select 1 from calendario_escolar c where c.anio_id = pol.anio_id and c.fecha = d::date and c.tipo = 'lectivo')
            else extract(isodow from d) between 1 and 5 and not exists (
              select 1 from calendario_escolar c where c.anio_id = pol.anio_id and c.fecha = d::date and c.tipo in ('feriado', 'no_lectivo'))
          end
    order by 1`.execute(db());
  return { fechas: r.rows.map((f) => f.fecha), calendario };
}

/** Inserta jornadas de sección; las que ya existen (sección + fecha) se omiten. */
export async function generarJornadasSeccion(e: {
  politicaId: string;
  anioId: string;
  seccionIds: string[];
  fechas: string[];
  entrada: string;
  salida: string;
}): Promise<number> {
  if (e.fechas.length === 0 || e.seccionIds.length === 0) return 0;
  const r = await sql<{ id: string }>`
    insert into jornadas_seccion (seccion_id, anio_id, grado_id, politica_id, fecha, entrada, salida)
    select s.id, s.anio_id, s.grado_id, ${e.politicaId}::bigint, f.fecha, ${e.entrada}::time, ${e.salida}::time
    from secciones s cross join unnest(${e.fechas}::date[]) as f(fecha)
    where s.id = any(${e.seccionIds}::bigint[]) and s.anio_id = ${e.anioId}::bigint
    on conflict do nothing
    returning id`.execute(db());
  return r.rows.length;
}

/** Inserta jornadas de docentes; las que se solapan con otra programada del mismo docente se omiten. */
export async function generarJornadasDocente(e: {
  politicaId: string;
  anioId: string;
  docenteIds: string[];
  fechas: string[];
  entrada: string;
  salida: string;
}): Promise<number> {
  if (e.fechas.length === 0 || e.docenteIds.length === 0) return 0;
  const r = await sql<{ id: string }>`
    insert into jornadas_docente (docente_id, anio_id, politica_id, fecha, entrada, salida)
    select d.id, ${e.anioId}::bigint, ${e.politicaId}::bigint, f.fecha, ${e.entrada}::time, ${e.salida}::time
    from docentes d cross join unnest(${e.fechas}::date[]) as f(fecha)
    where d.id = any(${e.docenteIds}::bigint[]) and d.activo
    on conflict do nothing
    returning id`.execute(db());
  return r.rows.length;
}

export async function opcionesGeneracion(anioId: string): Promise<OpcionesGeneracion> {
  const secciones = await db()
    .selectFrom('secciones as s')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select(['s.id', ETIQUETA_SECCION.as('etiqueta'), 's.turno'])
    .where('s.anio_id', '=', anioId)
    .where('s.activa', '=', true)
    .orderBy('n.id')
    .orderBy('g.numero')
    .orderBy('s.nombre')
    .execute();
  const docentes = await db()
    .selectFrom('docentes as d')
    .innerJoin('personas as p', 'p.id', 'd.persona_id')
    .select(['d.id', sql<string>`p.apellidos || ', ' || p.nombres || ' (' || d.codigo || ')'`.as('etiqueta')])
    .where('d.activo', '=', true)
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .execute();
  return { secciones, docentes };
}

export async function listarJornadas(
  f: { tipo: TipoJornada; q?: string; anioId?: string; desde?: string; hasta?: string; estado?: string },
  p: Paginacion | null,
) {
  if (f.tipo === 'seccion') {
    const base = () => {
      let q = db()
        .selectFrom('jornadas_seccion as j')
        .innerJoin('secciones as s', 's.id', 'j.seccion_id')
        .innerJoin('grados as g', 'g.id', 's.grado_id')
        .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
        .innerJoin('politicas_asistencia as p', 'p.id', 'j.politica_id');
      if (f.anioId) q = q.where('j.anio_id', '=', f.anioId);
      if (f.desde) q = q.where('j.fecha', '>=', f.desde);
      if (f.hasta) q = q.where('j.fecha', '<=', f.hasta);
      if (f.estado) q = q.where('j.estado', '=', f.estado);
      if (f.q) q = q.where(sql<boolean>`${ETIQUETA_SECCION} ilike ${`%${f.q}%`}`);
      return q;
    };
    const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
    const filas = await aplicarPaginacion(
      base()
        .select([
          'j.id',
          'j.fecha',
          'j.entrada',
          'j.salida',
          'j.estado',
          ETIQUETA_SECCION.as('destino'),
          'p.turno as politica',
          sql<string>`(select count(*) from asistencia_estudiantes a where a.jornada_id = j.id and a.sesion_id is null)`.as('registros'),
        ])
        .orderBy('j.fecha', 'desc')
        .orderBy('n.id')
        .orderBy('g.numero')
        .orderBy('s.nombre'),
      p,
    ).execute();
    return {
      filas: filas.map((x): FilaJornada => ({ ...x, tipo: 'seccion', registros: Number(x.registros ?? 0) })),
      total: Number(total.n),
    };
  }
  const base = () => {
    let q = db()
      .selectFrom('jornadas_docente as j')
      .innerJoin('docentes as d', 'd.id', 'j.docente_id')
      .innerJoin('personas as pe', 'pe.id', 'd.persona_id')
      .innerJoin('politicas_asistencia as p', 'p.id', 'j.politica_id');
    if (f.anioId) q = q.where('j.anio_id', '=', f.anioId);
    if (f.desde) q = q.where('j.fecha', '>=', f.desde);
    if (f.hasta) q = q.where('j.fecha', '<=', f.hasta);
    if (f.estado) q = q.where('j.estado', '=', f.estado);
    if (f.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || d.codigo) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'j.id',
        'j.fecha',
        'j.entrada',
        'j.salida',
        'j.estado',
        sql<string>`pe.apellidos || ', ' || pe.nombres`.as('destino'),
        'p.turno as politica',
        sql<string>`(select count(*) from asistencia_docentes a where a.jornada_id = j.id)`.as('registros'),
      ])
      .orderBy('j.fecha', 'desc')
      .orderBy('pe.apellidos')
      .orderBy('j.entrada'),
    p,
  ).execute();
  return {
    filas: filas.map((x): FilaJornada => ({ ...x, tipo: 'docente', registros: Number(x.registros ?? 0) })),
    total: Number(total.n),
  };
}

export async function cancelarJornada(tipo: TipoJornada, id: string) {
  const tabla = tipo === 'seccion' ? 'jornadas_seccion' : 'jornadas_docente';
  return db()
    .updateTable(tabla)
    .set({ estado: 'cancelada' })
    .where('id', '=', id)
    .where('estado', '=', 'programada')
    .returning(['id'])
    .executeTakeFirst();
}

export async function existeJornada(tipo: TipoJornada, id: string) {
  const tabla = tipo === 'seccion' ? 'jornadas_seccion' : 'jornadas_docente';
  const f = await db().selectFrom(tabla).select(['id', 'estado']).where('id', '=', id).executeTakeFirst();
  return f;
}

// ── Lectores QR ───────────────────────────────────────────────────────────────

export async function listarLectores(f: { q?: string; activo?: boolean }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('lectores_qr as l');
    if (f.activo !== undefined) q = q.where('l.activo', '=', f.activo);
    if (f.q) q = q.where(sql<boolean>`(l.codigo || ' ' || l.nombre) ilike ${`%${f.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'l.id',
        'l.codigo',
        'l.nombre',
        'l.activo',
        sql<string>`(select count(*) from marcaciones m where m.lector_id = l.id)`.as('marcaciones'),
        sql<Date | null>`(select max(m.instante) from marcaciones m where m.lector_id = l.id)`.as('ultima'),
      ])
      .orderBy('l.codigo'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (x): FilaLector => ({
        id: x.id,
        codigo: x.codigo,
        nombre: x.nombre,
        activo: x.activo,
        marcaciones: Number(x.marcaciones ?? 0),
        ultima_marcacion: x.ultima ? new Date(x.ultima).toISOString() : null,
      }),
    ),
    total: Number(total.n),
  };
}

export async function lectoresActivos() {
  return db().selectFrom('lectores_qr').select(['id', 'codigo', 'nombre']).where('activo', '=', true).orderBy('codigo').execute();
}

export async function obtenerLector(id: string) {
  return db().selectFrom('lectores_qr').select(['id', 'codigo', 'nombre', 'activo']).where('id', '=', id).executeTakeFirst();
}

export async function crearLector(d: DatosLector) {
  return db().insertInto('lectores_qr').values({ codigo: d.codigo, nombre: d.nombre, activo: d.activo }).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarLector(id: string, d: DatosLector) {
  return db().updateTable('lectores_qr').set({ codigo: d.codigo, nombre: d.nombre, activo: d.activo }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarLector(id: string) {
  return db().deleteFrom('lectores_qr').where('id', '=', id).returning(['id']).executeTakeFirst();
}
