import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type {
  DatosArea,
  DatosAsignatura,
  DatosCapacidad,
  DatosCompetencia,
  FilaArea,
  FilaAsignatura,
  FilaCapacidad,
  FilaCompetencia,
} from '@/esquemas/academico/curriculo';

// Currículo: áreas curriculares, asignaturas, competencias (versionadas) y capacidades.

export async function listarAreas(f: { q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('areas_curriculares as ar');
    if (f.q) q = q.where((eb) => eb.or([eb('ar.codigo', 'ilike', `%${f.q}%`), eb('ar.nombre', 'ilike', `%${f.q}%`)]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'ar.id',
        'ar.codigo',
        'ar.nombre',
        sql<string>`(select count(*) from asignaturas x where x.area_id = ar.id)`.as('asignaturas'),
        sql<string>`(select count(*) from competencias x where x.area_id = ar.id)`.as('competencias'),
      ])
      .orderBy('ar.nombre'),
    p,
  ).execute();
  return {
    filas: filas.map((r): FilaArea => ({ ...r, asignaturas: Number(r.asignaturas), competencias: Number(r.competencias) })),
    total: Number(total.n),
  };
}

export async function crearArea(d: DatosArea) {
  return db().insertInto('areas_curriculares').values({ codigo: d.codigo, nombre: d.nombre }).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarArea(id: string, d: DatosArea) {
  return db().updateTable('areas_curriculares').set({ codigo: d.codigo, nombre: d.nombre }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarArea(id: string) {
  return db().deleteFrom('areas_curriculares').where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function listarAsignaturas(f: { q?: string; areaId?: string; esTaller?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('asignaturas as x').leftJoin('areas_curriculares as ar', 'ar.id', 'x.area_id');
    if (f.areaId) q = q.where('x.area_id', '=', f.areaId);
    if (f.esTaller) q = q.where('x.es_taller', '=', f.esTaller === 'true');
    if (f.q) q = q.where((eb) => eb.or([eb('x.codigo', 'ilike', `%${f.q}%`), eb('x.nombre', 'ilike', `%${f.q}%`)]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'x.id',
        'x.codigo',
        'x.nombre',
        'x.area_id',
        'ar.nombre as area',
        'x.es_taller',
        sql<string>`(select count(*) from plan_asignaturas pa where pa.asignatura_id = x.id)`.as('planes'),
      ])
      .orderBy('x.nombre'),
    p,
  ).execute();
  return { filas: filas.map((r): FilaAsignatura => ({ ...r, planes: Number(r.planes) })), total: Number(total.n) };
}

function valoresAsignatura(d: DatosAsignatura) {
  return { codigo: d.codigo, nombre: d.nombre, area_id: d.areaId ?? null, es_taller: d.esTaller };
}

export async function crearAsignatura(d: DatosAsignatura) {
  return db().insertInto('asignaturas').values(valoresAsignatura(d)).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarAsignatura(id: string, d: DatosAsignatura) {
  return db().updateTable('asignaturas').set(valoresAsignatura(d)).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarAsignatura(id: string) {
  return db().deleteFrom('asignaturas').where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function listarCompetencias(f: { q?: string; areaId?: string; reportable?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('competencias as c').leftJoin('areas_curriculares as ar', 'ar.id', 'c.area_id');
    if (f.areaId) q = q.where('c.area_id', '=', f.areaId);
    if (f.reportable) q = q.where('c.reportable_siagie', '=', f.reportable === 'true');
    if (f.q) q = q.where((eb) => eb.or([eb('c.codigo', 'ilike', `%${f.q}%`), eb('c.nombre', 'ilike', `%${f.q}%`)]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'c.id',
        'c.codigo',
        'c.nombre',
        'c.version',
        'c.reportable_siagie',
        'c.area_id',
        'ar.nombre as area',
        sql<string>`(select count(*) from capacidades k where k.competencia_id = c.id)`.as('capacidades'),
      ])
      .orderBy('c.codigo')
      .orderBy('c.version', 'desc'),
    p,
  ).execute();
  return { filas: filas.map((r): FilaCompetencia => ({ ...r, capacidades: Number(r.capacidades) })), total: Number(total.n) };
}

function valoresCompetencia(d: DatosCompetencia) {
  return { codigo: d.codigo, nombre: d.nombre, version: d.version, reportable_siagie: d.reportableSiagie, area_id: d.areaId ?? null };
}

export async function crearCompetencia(d: DatosCompetencia) {
  return db().insertInto('competencias').values(valoresCompetencia(d)).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarCompetencia(id: string, d: DatosCompetencia) {
  return db().updateTable('competencias').set(valoresCompetencia(d)).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarCompetencia(id: string) {
  return db().deleteFrom('competencias').where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function obtenerCompetencia(id: string) {
  return db().selectFrom('competencias').select(['id', 'codigo', 'nombre', 'version']).where('id', '=', id).executeTakeFirst();
}

export async function listarCapacidades(competenciaId: string): Promise<FilaCapacidad[]> {
  return db()
    .selectFrom('capacidades')
    .select(['id', 'competencia_id', 'codigo', 'nombre'])
    .where('competencia_id', '=', competenciaId)
    .orderBy('codigo')
    .execute();
}

export async function crearCapacidad(competenciaId: string, d: DatosCapacidad) {
  return db().insertInto('capacidades').values({ competencia_id: competenciaId, codigo: d.codigo, nombre: d.nombre }).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarCapacidad(id: string, d: DatosCapacidad) {
  return db().updateTable('capacidades').set({ codigo: d.codigo, nombre: d.nombre }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarCapacidad(id: string) {
  return db().deleteFrom('capacidades').where('id', '=', id).returning(['id']).executeTakeFirst();
}
