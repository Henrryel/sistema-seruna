import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { DatosAnio, DatosBimestre, FilaAnio, FilaBimestre } from '@/esquemas/academico/anios';

// Repositorio: ÚNICO lugar con SQL/Kysely para años académicos y bimestres.

export async function listarAnios(filtros: { q?: string; estado?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('anios_academicos as a');
    if (filtros.estado) q = q.where('a.estado', '=', filtros.estado);
    if (filtros.q) q = q.where(sql<boolean>`a.anio::text like ${`%${filtros.q}%`}`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        'a.id',
        'a.anio',
        'a.inicio',
        'a.fin',
        'a.estado',
        eb.selectFrom('bimestres as b').select((e) => e.fn.countAll<string>().as('n')).whereRef('b.anio_id', '=', 'a.id').as('bimestres'),
      ])
      .orderBy('a.anio', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaAnio => ({ ...f, bimestres: Number(f.bimestres ?? 0) })),
    total: Number(total.n),
  };
}

export async function obtenerAnio(id: string) {
  return db().selectFrom('anios_academicos').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function crearAnio(d: DatosAnio) {
  return db()
    .insertInto('anios_academicos')
    .values({ anio: d.anio, inicio: d.inicio, fin: d.fin, estado: d.estado })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarAnio(id: string, d: DatosAnio) {
  return db()
    .updateTable('anios_academicos')
    .set({ anio: d.anio, inicio: d.inicio, fin: d.fin, estado: d.estado })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function listarBimestres(anioId: string): Promise<FilaBimestre[]> {
  const filas = await db()
    .selectFrom('bimestres')
    .select(['id', 'anio_id', 'numero', 'inicio', 'fin', 'registro_inicio', 'registro_fin'])
    .where('anio_id', '=', anioId)
    .orderBy('numero')
    .execute();
  return filas.map((f) => ({
    ...f,
    registro_inicio: f.registro_inicio ? f.registro_inicio.toISOString() : null,
    registro_fin: f.registro_fin ? f.registro_fin.toISOString() : null,
  }));
}

export async function obtenerBimestre(id: string) {
  return db().selectFrom('bimestres').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function crearBimestre(anioId: string, d: DatosBimestre) {
  return db()
    .insertInto('bimestres')
    .values({
      anio_id: anioId,
      numero: d.numero,
      inicio: d.inicio,
      fin: d.fin,
      registro_inicio: d.registroInicio,
      registro_fin: d.registroFin,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarBimestre(id: string, d: DatosBimestre) {
  return db()
    .updateTable('bimestres')
    .set({ numero: d.numero, inicio: d.inicio, fin: d.fin, registro_inicio: d.registroInicio, registro_fin: d.registroFin })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function eliminarBimestre(id: string) {
  return db().deleteFrom('bimestres').where('id', '=', id).returning(['id']).executeTakeFirst();
}
