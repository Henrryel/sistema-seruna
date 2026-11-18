import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaDiaCalendario, ResumenCalendario } from '@/esquemas/academico/calendario';

export async function listarDias(f: { anioId: string; tipo?: string; desde?: string; hasta?: string; q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('calendario_escolar as c').where('c.anio_id', '=', f.anioId);
    if (f.tipo) q = q.where('c.tipo', '=', f.tipo);
    if (f.desde) q = q.where('c.fecha', '>=', f.desde);
    if (f.hasta) q = q.where('c.fecha', '<=', f.hasta);
    if (f.q) q = q.where('c.descripcion', 'ilike', `%${f.q}%`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select(['c.anio_id', 'c.fecha', 'c.tipo', 'c.descripcion', sql<number>`extract(isodow from c.fecha)::int`.as('dia_semana')])
      .orderBy('c.fecha'),
    p,
  ).execute();
  return { filas: filas.map((r): FilaDiaCalendario => ({ ...r, dia_semana: Number(r.dia_semana) })), total: Number(total.n) };
}

export async function resumen(anioId: string): Promise<ResumenCalendario> {
  const filas = await db()
    .selectFrom('calendario_escolar')
    .select(['tipo', (eb) => eb.fn.countAll<string>().as('n')])
    .where('anio_id', '=', anioId)
    .groupBy('tipo')
    .execute();
  const n = (t: string) => Number(filas.find((f) => f.tipo === t)?.n ?? 0);
  return { lectivo: n('lectivo'), feriado: n('feriado'), no_lectivo: n('no_lectivo') };
}

export async function crearDia(d: { anioId: string; fecha: string; tipo: string; descripcion: string | null }) {
  return db()
    .insertInto('calendario_escolar')
    .values({ anio_id: d.anioId, fecha: d.fecha, tipo: d.tipo, descripcion: d.descripcion })
    .returning(['anio_id', 'fecha'])
    .executeTakeFirstOrThrow();
}

export async function actualizarDia(anioId: string, fecha: string, d: { tipo: string; descripcion: string | null }) {
  return db()
    .updateTable('calendario_escolar')
    .set({ tipo: d.tipo, descripcion: d.descripcion })
    .where('anio_id', '=', anioId)
    .where('fecha', '=', fecha)
    .returning(['anio_id', 'fecha'])
    .executeTakeFirst();
}

export async function eliminarDia(anioId: string, fecha: string) {
  return db().deleteFrom('calendario_escolar').where('anio_id', '=', anioId).where('fecha', '=', fecha).returning(['fecha']).executeTakeFirst();
}

/** Inserta lunes a viernes del rango como lectivos sin pisar los días ya registrados. Devuelve cuántos insertó. */
export async function generarLectivos(anioId: string, desde: string, hasta: string, descripcion: string | null) {
  const r = await sql<{ fecha: string }>`
    insert into calendario_escolar (anio_id, fecha, tipo, descripcion)
    select ${anioId}::bigint, d::date, 'lectivo', ${descripcion}
    from generate_series(${desde}::date, ${hasta}::date, interval '1 day') as d
    where extract(isodow from d) between 1 and 5
    on conflict (anio_id, fecha) do nothing
    returning fecha`.execute(db());
  return r.rows.length;
}
