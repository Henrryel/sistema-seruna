import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { ArqueoSesion, DatosCaja, DatosSerie, FilaCaja, FilaSerie, FilaSesion } from '@/esquemas/cobros/caja';
import { aCentimos, deCentimos } from '@/esquemas/cobros/dinero';
import { aIso } from './comunes';

// Repositorio: cajas, series de recibos y sesiones de caja (apertura, cierre y arqueo).

export async function listarCajas(filtros: { q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('cajas as c');
    if (filtros.q) q = q.where('c.nombre', 'ilike', `%${filtros.q}%`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('sesiones_caja as s', (j) => j.onRef('s.caja_id', '=', 'c.id').on('s.cerrada_en', 'is', null))
      .leftJoin('usuarios as u', 'u.id', 's.operador_id')
      .select(['c.id', 'c.nombre', 'c.activa', 's.id as sesion_abierta_id', 'u.login as operador', 's.abierta_en'])
      .orderBy('c.nombre'),
    p,
  ).execute();
  return { filas: filas.map((f): FilaCaja => ({ ...f, abierta_en: aIso(f.abierta_en) })), total: Number(total.n) };
}

export async function crearCaja(d: DatosCaja) {
  return db().insertInto('cajas').values({ nombre: d.nombre, activa: d.activa }).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarCaja(id: string, d: DatosCaja) {
  return db().updateTable('cajas').set({ nombre: d.nombre, activa: d.activa }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function obtenerCaja(id: string) {
  return db().selectFrom('cajas').select(['id', 'nombre', 'activa']).where('id', '=', id).executeTakeFirst();
}

export async function listarSeries(filtros: { q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('series_recibos as s');
    if (filtros.q) q = q.where('s.codigo', 'ilike', `%${filtros.q}%`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        's.id',
        's.codigo',
        's.numero_inicial',
        's.siguiente_numero',
        's.activa',
        eb.selectFrom('recibos_caja as r').select((e) => e.fn.countAll<string>().as('n')).whereRef('r.serie_id', '=', 's.id').as('recibos'),
      ])
      .orderBy('s.codigo'),
    p,
  ).execute();
  return { filas: filas.map((f): FilaSerie => ({ ...f, recibos: Number(f.recibos ?? 0) })), total: Number(total.n) };
}

export async function obtenerSerie(id: string) {
  return db()
    .selectFrom('series_recibos as s')
    .select((eb) => [
      's.id',
      's.codigo',
      's.numero_inicial',
      's.siguiente_numero',
      's.activa',
      eb.selectFrom('recibos_caja as r').select((e) => e.fn.countAll<string>().as('n')).whereRef('r.serie_id', '=', 's.id').as('recibos'),
    ])
    .where('s.id', '=', id)
    .forUpdate()
    .executeTakeFirst();
}

export async function crearSerie(d: DatosSerie) {
  return db()
    .insertInto('series_recibos')
    .values({ codigo: d.codigo, numero_inicial: d.numeroInicial, siguiente_numero: d.numeroInicial, activa: d.activa })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Serie sin recibos: se puede corregir código y numeración. */
export async function actualizarSerieCompleta(id: string, d: DatosSerie) {
  return db()
    .updateTable('series_recibos')
    .set({ codigo: d.codigo, numero_inicial: d.numeroInicial, siguiente_numero: d.numeroInicial, activa: d.activa })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

/** Serie con recibos emitidos: solo se activa o desactiva (el correlativo lo controla la base). */
export async function cambiarActivaSerie(id: string, activa: boolean) {
  return db().updateTable('series_recibos').set({ activa }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

// ---------- Sesiones de caja ----------

export async function abrirSesion(cajaId: string, operadorId: string, saldoInicial: string) {
  return db()
    .insertInto('sesiones_caja')
    .values({ caja_id: cajaId, operador_id: operadorId, saldo_inicial: saldoInicial })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function sesionAbiertaDeOperador(operadorId: string) {
  return db()
    .selectFrom('sesiones_caja')
    .select(['id', 'caja_id', 'operador_id', 'abierta_en', 'saldo_inicial'])
    .where('operador_id', '=', operadorId)
    .where('cerrada_en', 'is', null)
    .orderBy('abierta_en', 'desc')
    .limit(1)
    .executeTakeFirst();
}

export async function bloquearSesion(id: string) {
  return db()
    .selectFrom('sesiones_caja')
    .select(['id', 'caja_id', 'operador_id', 'abierta_en', 'cerrada_en', 'saldo_inicial', 'saldo_contado'])
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
}

export async function cerrarSesion(id: string, saldoContado: string) {
  return db()
    .updateTable('sesiones_caja')
    .set({ cerrada_en: sql`greatest(now(), abierta_en)`, saldo_contado: saldoContado })
    .where('id', '=', id)
    .where('cerrada_en', 'is', null)
    .returning(['id'])
    .executeTakeFirst();
}

/**
 * Arqueo: esperado = saldo inicial + efectivo cobrado en la sesión (sin pagos revertidos)
 * − devoluciones en efectivo registradas en la sesión.
 */
export async function arqueoSesion(id: string): Promise<ArqueoSesion | undefined> {
  const s = await db().selectFrom('sesiones_caja').select(['saldo_inicial', 'saldo_contado']).where('id', '=', id).executeTakeFirst();
  if (!s) return undefined;
  const pagos = await db()
    .selectFrom('pagos as p')
    .select([
      sql<string>`coalesce(sum(p.importe) filter (where p.medio = 'efectivo' and not exists (select 1 from reversiones_pago r where r.pago_id = p.id)), 0)`.as('efectivo'),
      sql<string>`coalesce(sum(p.importe) filter (where p.medio = 'efectivo' and exists (select 1 from reversiones_pago r where r.pago_id = p.id)), 0)`.as('revertido'),
      sql<string>`coalesce(sum(p.importe) filter (where p.medio <> 'efectivo' and not exists (select 1 from reversiones_pago r where r.pago_id = p.id)), 0)`.as('otros'),
      sql<string>`count(*)`.as('pagos'),
    ])
    .where('p.sesion_caja_id', '=', id)
    .executeTakeFirstOrThrow();
  const dev = await db()
    .selectFrom('devoluciones as d')
    .select(sql<string>`coalesce(sum(d.importe), 0)`.as('total'))
    .where('d.sesion_caja_id', '=', id)
    .executeTakeFirstOrThrow();
  const esperado = aCentimos(s.saldo_inicial) + aCentimos(pagos.efectivo) - aCentimos(dev.total);
  return {
    saldo_inicial: s.saldo_inicial,
    efectivo_cobrado: deCentimos(aCentimos(pagos.efectivo)),
    efectivo_revertido: deCentimos(aCentimos(pagos.revertido)),
    devoluciones_efectivo: deCentimos(aCentimos(dev.total)),
    otros_medios: deCentimos(aCentimos(pagos.otros)),
    pagos: Number(pagos.pagos),
    esperado: deCentimos(esperado),
    saldo_contado: s.saldo_contado,
    diferencia: s.saldo_contado === null ? null : deCentimos(aCentimos(s.saldo_contado) - esperado),
  };
}

const ESPERADO_SQL = sql<string>`(s.saldo_inicial
  + coalesce((select sum(p.importe) from pagos p where p.sesion_caja_id = s.id and p.medio = 'efectivo'
      and not exists (select 1 from reversiones_pago r where r.pago_id = p.id)), 0)
  - coalesce((select sum(d.importe) from devoluciones d where d.sesion_caja_id = s.id), 0))`;

export async function listarSesiones(
  filtros: { cajaId?: string; estado?: 'abierta' | 'cerrada'; desde?: string; hasta?: string; operadorId?: string; id?: string },
  p: Paginacion | null,
) {
  const base = () => {
    let q = db()
      .selectFrom('sesiones_caja as s')
      .innerJoin('cajas as c', 'c.id', 's.caja_id')
      .innerJoin('usuarios as u', 'u.id', 's.operador_id');
    if (filtros.id) q = q.where('s.id', '=', filtros.id);
    if (filtros.cajaId) q = q.where('s.caja_id', '=', filtros.cajaId);
    if (filtros.operadorId) q = q.where('s.operador_id', '=', filtros.operadorId);
    if (filtros.estado === 'abierta') q = q.where('s.cerrada_en', 'is', null);
    if (filtros.estado === 'cerrada') q = q.where('s.cerrada_en', 'is not', null);
    if (filtros.desde) q = q.where(sql<boolean>`(s.abierta_en at time zone 'America/Lima')::date >= ${filtros.desde}::date`);
    if (filtros.hasta) q = q.where(sql<boolean>`(s.abierta_en at time zone 'America/Lima')::date <= ${filtros.hasta}::date`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        's.id',
        's.caja_id',
        'c.nombre as caja',
        's.operador_id',
        'u.login as operador',
        's.abierta_en',
        's.cerrada_en',
        's.saldo_inicial',
        's.saldo_contado',
        ESPERADO_SQL.as('esperado'),
      ])
      .orderBy('s.abierta_en', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaSesion => ({
        ...f,
        abierta_en: aIso(f.abierta_en) ?? '',
        cerrada_en: aIso(f.cerrada_en),
        esperado: deCentimos(aCentimos(f.esperado)),
        diferencia: f.saldo_contado === null ? null : deCentimos(aCentimos(f.saldo_contado) - aCentimos(f.esperado)),
      }),
    ),
    total: Number(total.n),
  };
}
