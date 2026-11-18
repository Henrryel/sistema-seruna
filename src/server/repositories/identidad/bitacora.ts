import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaBitacora, OpcionesBitacora } from '@/esquemas/identidad/bitacora';

// Consulta de la bitácora (solo lectura). La escritura vive en src/server/repositories/bitacora.ts.

export interface FiltrosBitacora {
  accion?: string;
  entidad?: string;
  resultado?: string;
  actor?: string;
  desde?: string;
  hasta?: string;
  usuarioId?: string;
}

export async function listarBitacora(f: FiltrosBitacora, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('bitacora as b')
      .leftJoin('usuarios as a', 'a.id', 'b.actor_id')
      .leftJoin('usuarios as af', 'af.id', 'b.usuario_afectado_id');
    if (f.accion) q = q.where('b.accion', '=', f.accion);
    if (f.entidad) q = q.where('b.entidad', '=', f.entidad);
    if (f.resultado) q = q.where('b.resultado', '=', f.resultado);
    if (f.actor) q = q.where('a.login', 'like', `%${f.actor.toLowerCase()}%`);
    if (f.usuarioId) {
      const id = f.usuarioId;
      q = q.where((eb) => eb.or([eb('b.actor_id', '=', id), eb('b.usuario_afectado_id', '=', id)]));
    }
    // Las fechas se interpretan en America/Lima (día completo).
    if (f.desde) q = q.where('b.ocurrido_en', '>=', sql<Date>`(${f.desde}::date)::timestamp at time zone 'America/Lima'`);
    if (f.hasta) q = q.where('b.ocurrido_en', '<', sql<Date>`((${f.hasta}::date + 1))::timestamp at time zone 'America/Lima'`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'b.id',
        'b.ocurrido_en',
        'a.login as actor_login',
        'af.login as afectado_login',
        'b.accion',
        'b.entidad',
        'b.registro_id',
        'b.motivo',
        'b.resultado',
      ])
      .orderBy('b.ocurrido_en', 'desc')
      .orderBy('b.id', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map((r): FilaBitacora => ({ ...r, ocurrido_en: r.ocurrido_en.toISOString() })),
    total: Number(total.n),
  };
}

/** Valores distintos para los filtros (acotados para no recorrer toda la tabla en cada consulta). */
export async function opcionesBitacora(): Promise<OpcionesBitacora> {
  const distintos = async (columna: 'accion' | 'entidad' | 'resultado') => {
    const filas = await db().selectFrom('bitacora').select(columna).distinct().orderBy(columna).limit(300).execute();
    return filas.map((f) => f[columna] as string);
  };
  const [acciones, entidades, resultados] = await Promise.all([distintos('accion'), distintos('entidad'), distintos('resultado')]);
  return { acciones, entidades, resultados };
}
