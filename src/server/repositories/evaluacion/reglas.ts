import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { Criterios } from '@/esquemas/evaluacion/criterios';
import type { FilaRegla } from '@/esquemas/evaluacion/reglas';

// Reglas de evaluación versionadas. Inmutables una vez aprobadas (`proteger_regla_evaluacion`).

function base() {
  return db()
    .selectFrom('reglas_evaluacion as r')
    .innerJoin('anios_academicos as a', 'a.id', 'r.anio_id')
    .innerJoin('grados as g', 'g.id', 'r.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .leftJoin('usuarios as u', 'u.id', 'r.aprobado_por');
}

function seleccion(q: ReturnType<typeof base>) {
  return q.select([
    'r.id',
    'r.anio_id',
    'a.anio',
    'r.grado_id',
    'g.numero as grado',
    'n.nombre as nivel',
    'r.version',
    'r.referencia_normativa',
    'r.criterios',
    'r.aprobado_en',
    'u.login as aprobado_por',
    'r.evidencia_id',
    sql<string>`(select count(*) from cierres_anuales x where x.regla_id = r.id)`.as('usos'),
  ]);
}

const aFila = (f: Awaited<ReturnType<ReturnType<typeof seleccion>['execute']>>[number]): FilaRegla => ({
  ...f,
  criterios: f.criterios as FilaRegla['criterios'],
  aprobado_en: f.aprobado_en ? f.aprobado_en.toISOString() : null,
  usos: Number(f.usos ?? 0),
});

export async function listarReglas(filtros: { anioId?: string; gradoId?: string; estado?: string; q?: string }, p: Paginacion | null) {
  const filtrar = (q: ReturnType<typeof base>) => {
    let r = q;
    if (filtros.anioId) r = r.where('r.anio_id', '=', filtros.anioId);
    if (filtros.gradoId) r = r.where('r.grado_id', '=', filtros.gradoId);
    if (filtros.estado === 'aprobada') r = r.where('r.aprobado_en', 'is not', null);
    if (filtros.estado === 'borrador') r = r.where('r.aprobado_en', 'is', null);
    if (filtros.q) r = r.where('r.referencia_normativa', 'ilike', `%${filtros.q}%`);
    return r;
  };
  const total = await filtrar(base()).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    seleccion(filtrar(base())).orderBy('a.anio', 'desc').orderBy('g.nivel_id').orderBy('g.numero').orderBy('r.version', 'desc'),
    p,
  ).execute();
  return { filas: filas.map(aFila), total: Number(total.n) };
}

export async function obtenerRegla(id: string) {
  const f = await seleccion(base()).where('r.id', '=', id).executeTakeFirst();
  return f ? aFila(f) : undefined;
}

export async function crearRegla(d: { anioId: string; gradoId: string; referenciaNormativa: string; criterios: Criterios }) {
  return db()
    .insertInto('reglas_evaluacion')
    .values({
      anio_id: d.anioId,
      grado_id: d.gradoId,
      version: sql<number>`(select coalesce(max(version), 0) + 1 from reglas_evaluacion where anio_id = ${d.anioId} and grado_id = ${d.gradoId})`,
      referencia_normativa: d.referenciaNormativa,
      criterios: JSON.stringify(d.criterios),
    })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow();
}

export async function actualizarRegla(id: string, d: { referenciaNormativa: string; criterios: Criterios }) {
  return db()
    .updateTable('reglas_evaluacion')
    .set({ referencia_normativa: d.referenciaNormativa, criterios: JSON.stringify(d.criterios) })
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst();
}

export async function fijarEvidencia(id: string, archivoId: string) {
  return db().updateTable('reglas_evaluacion').set({ evidencia_id: archivoId }).where('id', '=', id).returning('id').executeTakeFirst();
}

export async function aprobarRegla(id: string, usuarioId: string) {
  return db()
    .updateTable('reglas_evaluacion')
    .set({ aprobado_por: usuarioId, aprobado_en: sql<Date>`clock_timestamp()` })
    .where('id', '=', id)
    .returning(['id', 'aprobado_en'])
    .executeTakeFirst();
}

export async function eliminarRegla(id: string) {
  return db().deleteFrom('reglas_evaluacion').where('id', '=', id).returning('id').executeTakeFirst();
}
