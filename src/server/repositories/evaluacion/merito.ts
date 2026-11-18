import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { CandidatoMerito, FilaPublicacion, PuestoMerito } from '@/esquemas/evaluacion/merito';

// Orden de mérito: la base NO lo calcula. Se registra el listado oficial de SIAGIE (archivo + referencia) y sus
// puestos; `controlar_publicacion_merito` y `controlar_puesto_merito` validan nivel, regla, consecutividad e
// inmutabilidad tras publicar.

function base() {
  return db()
    .selectFrom('publicaciones_merito as pm')
    .innerJoin('anios_academicos as a', 'a.id', 'pm.anio_id')
    .innerJoin('grados as g', 'g.id', 'pm.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('archivos as f', 'f.id', 'pm.archivo_siagie_id');
}

function seleccion(q: ReturnType<typeof base>) {
  return q.select([
    'pm.id',
    'pm.anio_id',
    'a.anio',
    'pm.grado_id',
    'g.numero as grado',
    'n.nombre as nivel',
    'pm.alcance',
    'pm.version',
    'pm.referencia_siagie',
    'pm.archivo_siagie_id',
    'f.nombre_original as archivo',
    'pm.registrado_en',
    'pm.publicado_en',
    sql<string>`(select count(*) from orden_merito o where o.publicacion_id = pm.id)`.as('puestos'),
  ]);
}

const aFila = (f: Awaited<ReturnType<ReturnType<typeof seleccion>['execute']>>[number]): FilaPublicacion => ({
  ...f,
  registrado_en: f.registrado_en.toISOString(),
  publicado_en: f.publicado_en ? f.publicado_en.toISOString() : null,
  puestos: Number(f.puestos ?? 0),
});

export async function listarPublicaciones(filtros: { anioId?: string; gradoId?: string; q?: string }, p: Paginacion | null) {
  const filtrar = (q: ReturnType<typeof base>) => {
    let r = q;
    if (filtros.anioId) r = r.where('pm.anio_id', '=', filtros.anioId);
    if (filtros.gradoId) r = r.where('pm.grado_id', '=', filtros.gradoId);
    if (filtros.q) r = r.where('pm.referencia_siagie', 'ilike', `%${filtros.q}%`);
    return r;
  };
  const total = await filtrar(base()).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    seleccion(filtrar(base())).orderBy('a.anio', 'desc').orderBy('g.numero').orderBy('pm.alcance').orderBy('pm.version', 'desc'),
    p,
  ).execute();
  return { filas: filas.map(aFila), total: Number(total.n) };
}

export async function obtenerPublicacion(id: string) {
  const f = await seleccion(base()).where('pm.id', '=', id).executeTakeFirst();
  return f ? aFila(f) : undefined;
}

export async function crearPublicacion(d: {
  anioId: string;
  gradoId: string;
  alcance: string;
  reglaId: string;
  archivoId: string;
  referenciaSiagie: string;
  registradoPor: string;
}) {
  return db()
    .insertInto('publicaciones_merito')
    .values({
      anio_id: d.anioId,
      grado_id: d.gradoId,
      regla_id: d.reglaId,
      alcance: d.alcance,
      version: sql<number>`(select coalesce(max(version), 0) + 1 from publicaciones_merito
        where anio_id = ${d.anioId} and grado_id = ${d.gradoId} and alcance = ${d.alcance})`,
      archivo_siagie_id: d.archivoId,
      referencia_siagie: d.referenciaSiagie,
      registrado_por: d.registradoPor,
    })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow();
}

const ALUMNO = sql<string>`p.apellidos || ', ' || p.nombres`;

export async function puestosDe(publicacionId: string): Promise<PuestoMerito[]> {
  return db()
    .selectFrom('orden_merito as o')
    .innerJoin('cierres_anuales as ca', 'ca.id', 'o.cierre_anual_id')
    .innerJoin('matriculas as m', 'm.id', 'o.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .leftJoin('secciones as s', 's.id', 'ca.seccion_id')
    .select(['o.matricula_id', 'o.cierre_anual_id', 'e.codigo', 'e.codigo_siagie', ALUMNO.as('alumno'), 's.nombre as seccion', 'o.puesto', 'o.calificativo', 'o.sustento_desempate'])
    .where('o.publicacion_id', '=', publicacionId)
    .orderBy('o.puesto')
    .execute();
}

/** Matrículas del año/grado con cierre lectivo aprobado (último no de recuperación) aún sin puesto. */
export async function candidatos(publicacionId: string, anioId: string, gradoId: string): Promise<CandidatoMerito[]> {
  return db()
    .with('lectivos', (qb) =>
      qb
        .selectFrom('cierres_anuales')
        .select(['id', 'matricula_id', 'seccion_id', 'situacion'])
        .distinctOn('matricula_id')
        .where('anio_id', '=', anioId)
        .where('grado_id', '=', gradoId)
        .where('estado', '=', 'aprobado')
        .where('etapa', '<>', 'recuperacion')
        .orderBy('matricula_id')
        .orderBy('version', 'desc'),
    )
    .selectFrom('lectivos as ca')
    .innerJoin('matriculas as m', 'm.id', 'ca.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .leftJoin('secciones as s', 's.id', 'ca.seccion_id')
    .select(['ca.matricula_id', 'ca.id as cierre_anual_id', 'e.codigo', 'e.codigo_siagie', ALUMNO.as('alumno'), 's.nombre as seccion', 'ca.situacion'])
    .where(({ not, exists, selectFrom }) =>
      not(exists(selectFrom('orden_merito as o').select('o.puesto').where('o.publicacion_id', '=', publicacionId).whereRef('o.matricula_id', '=', 'ca.matricula_id'))),
    )
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .execute() as Promise<CandidatoMerito[]>;
}

/** Último cierre lectivo aprobado (no de recuperación) de la matrícula. */
export async function cierreLectivo(matriculaId: string) {
  return db()
    .selectFrom('cierres_anuales')
    .select('id')
    .where('matricula_id', '=', matriculaId)
    .where('estado', '=', 'aprobado')
    .where('etapa', '<>', 'recuperacion')
    .orderBy('version', 'desc')
    .executeTakeFirst();
}

export async function quitarPuesto(publicacionId: string, matriculaId: string) {
  return db().deleteFrom('orden_merito').where('publicacion_id', '=', publicacionId).where('matricula_id', '=', matriculaId).returning('puesto').executeTakeFirst();
}

export async function insertarPuesto(d: {
  publicacionId: string;
  matriculaId: string;
  cierreAnualId: string;
  puesto: number;
  calificativo: string;
  sustentoDesempate: string | null;
}) {
  return db()
    .insertInto('orden_merito')
    .values({
      publicacion_id: d.publicacionId,
      matricula_id: d.matriculaId,
      cierre_anual_id: d.cierreAnualId,
      puesto: d.puesto,
      calificativo: d.calificativo,
      sustento_desempate: d.sustentoDesempate,
    })
    .execute();
}

export async function publicar(id: string, usuarioId: string) {
  return db()
    .updateTable('publicaciones_merito')
    .set({ publicado_por: usuarioId, publicado_en: sql<Date>`clock_timestamp()` })
    .where('id', '=', id)
    .returning(['id', 'publicado_en'])
    .executeTakeFirst();
}

export async function eliminarPublicacion(id: string) {
  await db().deleteFrom('orden_merito').where('publicacion_id', '=', id).execute();
  return db().deleteFrom('publicaciones_merito').where('id', '=', id).returning('id').executeTakeFirst();
}

/** Vista `orden_merito_publicado` (última versión publicada por año, grado y alcance). */
export async function meritoPublicado(filtros: { anioId?: string; gradoId?: string }) {
  let q = db()
    .selectFrom('orden_merito_publicado as v')
    .innerJoin('matriculas as m', 'm.id', 'v.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .innerJoin('grados as g', 'g.id', 'v.grado_id')
    .select(['v.publicacion_id', 'v.anio_id', 'v.grado_id', 'g.numero as grado', 'v.alcance', 'v.version', 'v.publicado_en', 'v.referencia_siagie', 'v.matricula_id', 'e.codigo', ALUMNO.as('alumno'), 'v.puesto', 'v.calificativo'])
    .orderBy('g.numero')
    .orderBy('v.alcance')
    .orderBy('v.puesto');
  if (filtros.anioId) q = q.where('v.anio_id', '=', filtros.anioId);
  if (filtros.gradoId) q = q.where('v.grado_id', '=', filtros.gradoId);
  return q.execute();
}
