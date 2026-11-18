import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type {
  FilaAceptacion,
  FilaMatricula,
  FilaMovimiento,
  FilaNomina,
  FilaResponsable,
  FilaUbicacion,
  SeccionDisponible,
} from '@/esquemas/matricula/matriculas';
import { iso, patronLike } from './personas';

const HOY = sql<string>`(now() at time zone 'America/Lima')::date`;

/** Sección de la ubicación más reciente de la matrícula `m`. */
const SECCION_ACTUAL = sql<string | null>`(
  select s.nombre from matricula_secciones ms join secciones s on s.id = ms.seccion_id
  where ms.matricula_id = m.id order by upper(ms.vigencia) desc limit 1)`;

const GRADO = sql<string>`(g.numero || '.º ' || n.nombre)`;

interface FiltrosMatriculas {
  q?: string;
  anioId?: string;
  gradoId?: string;
  seccionId?: string;
  estudianteId?: string;
  estado?: string;
  tipoIngreso?: string;
}

function consultaBase(filtros: FiltrosMatriculas) {
  let q = db()
    .selectFrom('matriculas as m')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .innerJoin('anios_academicos as a', 'a.id', 'm.anio_id')
    .innerJoin('grados as g', 'g.id', 'm.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('reglas_matricula as r', 'r.id', 'm.regla_id');
  if (filtros.anioId) q = q.where('m.anio_id', '=', filtros.anioId);
  if (filtros.gradoId) q = q.where('m.grado_id', '=', filtros.gradoId);
  if (filtros.estudianteId) q = q.where('m.estudiante_id', '=', filtros.estudianteId);
  if (filtros.estado) q = q.where('m.estado', '=', filtros.estado);
  if (filtros.tipoIngreso) q = q.where('m.tipo_ingreso', '=', filtros.tipoIngreso);
  if (filtros.seccionId) {
    const seccionId = filtros.seccionId;
    q = q.where((eb) =>
      eb.exists(eb.selectFrom('matricula_secciones as ms').select('ms.id').whereRef('ms.matricula_id', '=', 'm.id').where('ms.seccion_id', '=', seccionId)),
    );
  }
  if (filtros.q) {
    const patron = patronLike(filtros.q);
    q = q.where((eb) =>
      eb.or([sql<boolean>`(p.apellidos || ' ' || p.nombres) ilike ${patron}`, sql<boolean>`(p.nombres || ' ' || p.apellidos) ilike ${patron}`, eb('e.codigo', 'ilike', patron)]),
    );
  }
  return q;
}

const COLUMNAS = [
  'm.id',
  'm.estudiante_id',
  'e.codigo',
  'p.nombres',
  'p.apellidos',
  'm.anio_id',
  'a.anio',
  'm.grado_id',
  GRADO.as('grado'),
  'm.tipo_ingreso',
  'm.estado',
  'm.solicitada_en',
  'm.confirmada_en',
  SECCION_ACTUAL.as('seccion'),
  'r.version as regla_version',
] as const;

const aFila = <T extends { solicitada_en: Date; confirmada_en: Date | null }>(f: T) => ({
  ...f,
  solicitada_en: iso(f.solicitada_en) as string,
  confirmada_en: iso(f.confirmada_en),
});

export async function listarMatriculas(filtros: FiltrosMatriculas, p: Paginacion | null) {
  const total = await consultaBase(filtros).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    consultaBase(filtros).select(COLUMNAS).orderBy('a.anio', 'desc').orderBy('n.id').orderBy('g.numero').orderBy('p.apellidos').orderBy('p.nombres'),
    p,
  ).execute();
  return { filas: filas.map((f): FilaMatricula => aFila(f)), total: Number(total.n) };
}

/** Datos completos de una matrícula. `bloquear` toma FOR UPDATE sobre la fila de matrículas. */
export async function obtenerMatricula(id: string, bloquear = false) {
  let q = consultaBase({})
    .select([
      ...COLUMNAS,
      'm.referencia_siagie',
      'm.regla_id',
      'a.inicio as anio_inicio',
      'a.fin as anio_fin',
      'n.nombre as nivel',
      'e.persona_id',
      'e.codigo_siagie',
      'p.fecha_nacimiento',
    ])
    .where('m.id', '=', id);
  if (bloquear) q = q.forUpdate('m');
  const f = await q.executeTakeFirst();
  return f ? aFila(f) : undefined;
}

export async function crearMatricula(d: {
  estudianteId: string;
  anioId: string;
  gradoId: string;
  reglaId: string;
  tipoIngreso: string;
  referenciaSiagie: string | null;
  registradoPor: string;
}) {
  return db()
    .insertInto('matriculas')
    .values({
      estudiante_id: d.estudianteId,
      anio_id: d.anioId,
      grado_id: d.gradoId,
      regla_id: d.reglaId,
      tipo_ingreso: d.tipoIngreso,
      referencia_siagie: d.referenciaSiagie,
      registrado_por: d.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function cambiarEstado(id: string, estado: string, opciones: { confirmar?: boolean } = {}) {
  return db()
    .updateTable('matriculas')
    .set(opciones.confirmar ? { estado, confirmada_en: sql`now()` } : { estado })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

// Ubicaciones (matricula_secciones). El trigger controlar_cupo valida sección activa, año y cupos.

export async function listarUbicaciones(matriculaId: string): Promise<FilaUbicacion[]> {
  return db()
    .selectFrom('matricula_secciones as ms')
    .innerJoin('secciones as s', 's.id', 'ms.seccion_id')
    .select([
      'ms.id',
      'ms.seccion_id',
      's.nombre as seccion',
      's.turno',
      sql<string>`lower(ms.vigencia)`.as('desde'),
      sql<string>`upper(ms.vigencia) - 1`.as('hasta'),
      'ms.tipo_vacante',
    ])
    .where('ms.matricula_id', '=', matriculaId)
    .orderBy(sql`lower(ms.vigencia)`)
    .execute();
}

/** Ubicación cuya vigencia contiene la fecha. */
export async function ubicacionEn(matriculaId: string, fecha: string) {
  return db()
    .selectFrom('matricula_secciones')
    .select(['id', 'seccion_id', 'tipo_vacante', sql<string>`lower(vigencia)`.as('desde'), sql<string>`upper(vigencia)`.as('hasta_exclusivo')])
    .where('matricula_id', '=', matriculaId)
    .where(sql<boolean>`vigencia @> ${fecha}::date`)
    .executeTakeFirst();
}

/** Ubicaciones que siguen vigentes en la fecha o empiezan después. */
export async function ubicacionesDesde(matriculaId: string, fecha: string) {
  return db()
    .selectFrom('matricula_secciones')
    .select(['id', 'seccion_id', sql<string>`lower(vigencia)`.as('desde')])
    .where('matricula_id', '=', matriculaId)
    .where(sql<boolean>`upper(vigencia) > ${fecha}::date`)
    .orderBy(sql`lower(vigencia)`)
    .execute();
}

/** Cierra la ubicación: queda vigente hasta el día anterior a `fecha`. */
export async function cerrarUbicacion(id: string, fecha: string) {
  return db()
    .updateTable('matricula_secciones')
    .set({ vigencia: sql<string>`daterange(lower(vigencia), ${fecha}::date, '[)')` })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function eliminarUbicaciones(matriculaId: string) {
  return db().deleteFrom('matricula_secciones').where('matricula_id', '=', matriculaId).returning(['id']).execute();
}

export async function crearUbicacion(d: {
  matriculaId: string;
  seccionId: string;
  anioId: string;
  gradoId: string;
  desde: string;
  /** Fin EXCLUSIVO (p. ej. el día siguiente al fin del año). */
  hastaExclusivo: string;
  tipoVacante: string;
  registradoPor: string;
}) {
  return db()
    .insertInto('matricula_secciones')
    .values({
      matricula_id: d.matriculaId,
      seccion_id: d.seccionId,
      anio_id: d.anioId,
      grado_id: d.gradoId,
      vigencia: sql<string>`daterange(${d.desde}::date, ${d.hastaExclusivo}::date, '[)')`,
      tipo_vacante: d.tipoVacante,
      registrado_por: d.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function obtenerSeccion(id: string) {
  return db().selectFrom('secciones').select(['id', 'nombre', 'turno', 'anio_id', 'grado_id', 'activa']).where('id', '=', id).executeTakeFirst();
}

/** Secciones del año y grado con su ocupación en la fecha (informativo; el cupo lo controla la base). */
export async function seccionesConOcupacion(anioId: string, gradoId: string, fecha: string): Promise<SeccionDisponible[]> {
  const filas = await db()
    .selectFrom('secciones as s')
    .select([
      's.id',
      's.nombre',
      's.turno',
      's.cupo',
      's.reserva',
      's.activa',
      sql<string>`(select count(*) from matricula_secciones ms where ms.seccion_id = s.id and ms.vigencia @> ${fecha}::date)`.as('ocupadas'),
    ])
    .where('s.anio_id', '=', anioId)
    .where('s.grado_id', '=', gradoId)
    .orderBy('s.nombre')
    .execute();
  return filas.map((f) => ({ ...f, ocupadas: Number(f.ocupadas) }));
}

// Movimientos (sin trigger: los registra el servicio).

export async function registrarMovimiento(d: {
  matriculaId: string;
  tipo: string;
  fechaEfectiva: string;
  motivo: string;
  detalle?: string | null;
  evidenciaId?: string | null;
  registradoPor: string;
}) {
  return db()
    .insertInto('movimientos_matricula')
    .values({
      matricula_id: d.matriculaId,
      tipo: d.tipo,
      fecha_efectiva: d.fechaEfectiva,
      motivo: d.motivo,
      detalle: d.detalle ?? null,
      evidencia_id: d.evidenciaId ?? null,
      registrado_por: d.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function listarMovimientos(matriculaId: string): Promise<FilaMovimiento[]> {
  const filas = await db()
    .selectFrom('movimientos_matricula as mv')
    .innerJoin('usuarios as u', 'u.id', 'mv.registrado_por')
    .select(['mv.id', 'mv.tipo', 'mv.fecha_efectiva', 'mv.motivo', 'mv.detalle', 'mv.evidencia_id', 'u.login as registrado_por', 'mv.registrado_en'])
    .where('mv.matricula_id', '=', matriculaId)
    .orderBy('mv.registrado_en')
    .orderBy('mv.id')
    .execute();
  return filas.map((f) => ({ ...f, registrado_en: iso(f.registrado_en) as string }));
}

// Responsables económicos (vigencia sin solapes por matrícula: EXCLUDE).

const COLUMNAS_RESPONSABLE = [
  'r.id',
  'r.matricula_id',
  'r.persona_id',
  'r.tipo_documento',
  'r.numero_documento',
  'r.nombre_razon_social',
  'r.direccion',
  sql<string>`lower(r.vigencia)`.as('desde'),
  sql<string | null>`upper(r.vigencia) - 1`.as('hasta'),
  sql<boolean>`r.vigencia @> ${HOY}`.as('vigente'),
] as const;

export async function listarResponsables(filtro: { matriculaId?: string; estudianteId?: string }): Promise<FilaResponsable[]> {
  let q = db()
    .selectFrom('responsables_economicos as r')
    .innerJoin('matriculas as m', 'm.id', 'r.matricula_id')
    .innerJoin('anios_academicos as a', 'a.id', 'm.anio_id')
    .select([...COLUMNAS_RESPONSABLE, 'a.anio']);
  if (filtro.matriculaId) q = q.where('r.matricula_id', '=', filtro.matriculaId);
  if (filtro.estudianteId) q = q.where('m.estudiante_id', '=', filtro.estudianteId);
  return q.orderBy('a.anio', 'desc').orderBy(sql`lower(r.vigencia)`, 'desc').execute();
}

/** Responsable cuya vigencia contiene la fecha. */
export async function responsableEn(matriculaId: string, fecha: string) {
  return db()
    .selectFrom('responsables_economicos')
    .select(['id', sql<string>`lower(vigencia)`.as('desde')])
    .where('matricula_id', '=', matriculaId)
    .where(sql<boolean>`vigencia @> ${fecha}::date`)
    .executeTakeFirst();
}

export async function cerrarResponsable(id: string, fecha: string) {
  return db()
    .updateTable('responsables_economicos')
    .set({ vigencia: sql<string>`daterange(lower(vigencia), ${fecha}::date, '[)')` })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function crearResponsable(d: {
  matriculaId: string;
  personaId: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  nombreRazonSocial: string;
  direccion: string | null;
  desde: string;
}) {
  return db()
    .insertInto('responsables_economicos')
    .values({
      matricula_id: d.matriculaId,
      persona_id: d.personaId,
      tipo_documento: d.tipoDocumento,
      numero_documento: d.numeroDocumento,
      nombre_razon_social: d.nombreRazonSocial,
      direccion: d.direccion,
      vigencia: sql<string>`daterange(${d.desde}::date, null, '[)')`,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

// Aceptaciones de documentos institucionales.

export async function listarAceptaciones(matriculaId: string): Promise<FilaAceptacion[]> {
  const filas = await db()
    .selectFrom('aceptaciones_documento as ac')
    .innerJoin('documentos_institucionales as d', 'd.id', 'ac.documento_id')
    .innerJoin('personas as p', 'p.id', 'ac.firmante_id')
    .select([
      'ac.id',
      'ac.documento_id',
      'd.tipo',
      'd.version',
      'ac.firmante_id',
      sql<string>`p.apellidos || ', ' || p.nombres`.as('firmante'),
      'ac.aceptado_en',
      'ac.metodo',
      'ac.evidencia_id',
    ])
    .where('ac.matricula_id', '=', matriculaId)
    .orderBy('ac.aceptado_en')
    .execute();
  return filas.map((f) => ({ ...f, aceptado_en: iso(f.aceptado_en) as string }));
}

export async function crearAceptacion(d: {
  matriculaId: string;
  anioId: string;
  gradoId: string;
  documentoId: string;
  firmanteId: string;
  metodo: string;
  fecha: string | null;
  evidenciaId: string | null;
}) {
  return db()
    .insertInto('aceptaciones_documento')
    .values({
      matricula_id: d.matriculaId,
      anio_id: d.anioId,
      grado_id: d.gradoId,
      documento_id: d.documentoId,
      firmante_id: d.firmanteId,
      metodo: d.metodo,
      aceptado_en: d.fecha ? sql<Date>`${d.fecha}::date::timestamptz` : sql<Date>`now()`,
      evidencia_id: d.evidenciaId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

// Nómina (vista reporte_nomina_matriculas).

export async function nomina(
  filtros: { q?: string; anioId?: string; gradoId?: string; seccionId?: string; estado?: string; fecha?: string },
  p: Paginacion | null,
) {
  const interna = () => {
    let q = db().selectFrom('reporte_nomina_matriculas as v').selectAll('v');
    if (filtros.anioId) q = q.where('v.anio_id', '=', filtros.anioId);
    if (filtros.gradoId) q = q.where('v.grado_id', '=', filtros.gradoId);
    if (filtros.estado) q = q.where('v.estado', '=', filtros.estado);
    if (filtros.fecha) q = q.where(sql<boolean>`v.vigencia @> ${filtros.fecha}::date`);
    if (filtros.q) {
      const patron = patronLike(filtros.q);
      q = q.where((eb) =>
        eb.or([sql<boolean>`(v.apellidos || ' ' || v.nombres) ilike ${patron}`, eb('v.codigo', 'ilike', patron), eb('v.codigo_siagie', 'ilike', patron)]),
      );
    }
    // Una fila por matrícula: la ubicación vigente en la fecha o la más reciente.
    return q
      .distinctOn('v.matricula_id')
      .orderBy('v.matricula_id')
      .orderBy(sql`upper(v.vigencia)`, (ob) => ob.desc().nullsLast());
  };
  const base = () => {
    let q = db().selectFrom(interna().as('x'));
    if (filtros.seccionId) q = q.where('x.seccion_id', '=', filtros.seccionId);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'x.matricula_id',
        'x.estudiante_id',
        'x.codigo',
        'x.codigo_siagie',
        'x.apellidos',
        'x.nombres',
        'x.nivel',
        'x.grado',
        'x.seccion',
        'x.estado',
        'x.tipo_ingreso',
        sql<string | null>`lower(x.vigencia)`.as('desde'),
        sql<string | null>`upper(x.vigencia) - 1`.as('hasta'),
      ])
      .orderBy(sql`(select g.nivel_id from grados g where g.id = x.grado_id)`)
      .orderBy('x.grado')
      .orderBy('x.seccion')
      .orderBy('x.apellidos')
      .orderBy('x.nombres'),
    p,
  ).execute();
  const inicio = p ? p.desplazamiento : 0;
  return {
    filas: filas.map(
      (f, i): FilaNomina => ({
        numero: inicio + i + 1,
        matricula_id: f.matricula_id ?? '',
        estudiante_id: f.estudiante_id ?? '',
        codigo: f.codigo ?? '',
        codigo_siagie: f.codigo_siagie,
        apellidos: f.apellidos ?? '',
        nombres: f.nombres ?? '',
        nivel: f.nivel ?? '',
        grado: f.grado ?? 0,
        seccion: f.seccion,
        estado: f.estado ?? '',
        tipo_ingreso: f.tipo_ingreso ?? '',
        desde: f.desde,
        hasta: f.hasta,
      }),
    ),
    total: Number(total.n),
  };
}
