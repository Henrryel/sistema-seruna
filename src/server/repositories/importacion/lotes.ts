import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { Json } from '@/server/db/tipos';
import type { FilaArchivoHistorico, FilaImportacionVista, FilaLote, FilaResumenImportacion } from '@/esquemas/importacion/lotes';

// Importación histórica. El ciclo carga → revisión → cerrado lo controla `avanzar_lote_historico`; la carga
// solo de inserción y sin credenciales/anidados, `controlar_carga_historica`; la conciliación,
// `conciliar_fila_historica` (permiso datos.conciliar_historico verificado en la base).

const TAM_BLOQUE = 500;

export async function crearLote(d: { sistema: string; sha256: Buffer; conteos: Record<string, number>; creadoPor: string }) {
  return db()
    .insertInto('lotes_importacion')
    .values({
      sistema: d.sistema,
      sha256: d.sha256,
      conteos_esperados: sql<Json>`${JSON.stringify(d.conteos)}::jsonb`,
      creado_por: d.creadoPor,
    })
    .returning(['id', 'estado'])
    .executeTakeFirstOrThrow();
}

/** Inserta filas crudas en bloques (cada fila pasa por el trigger de control de carga). */
export async function insertarFilas(loteId: string, filas: { entidad: string; claveOrigen: string; datos: Record<string, unknown> }[]) {
  for (let i = 0; i < filas.length; i += TAM_BLOQUE) {
    const bloque = filas.slice(i, i + TAM_BLOQUE);
    await db()
      .insertInto('filas_importacion')
      .values(
        bloque.map((f) => ({
          lote_id: loteId,
          entidad: f.entidad,
          clave_origen: f.claveOrigen,
          datos: sql<Json>`${JSON.stringify(f.datos)}::jsonb`,
        })),
      )
      .execute();
  }
  return filas.length;
}

const columnasLote = [
  'l.id',
  'l.sistema',
  sql<string>`encode(l.sha256, 'hex')`.as('sha256'),
  'l.conteos_esperados',
  'u.login as creado_por_login',
  'l.creado_en',
  'l.estado',
  'l.sellado_en',
  'l.cerrado_en',
  sql<string>`coalesce((select sum(r.cargadas) from resumen_importacion_historica r where r.lote_id = l.id), 0)`.as('cargadas'),
  sql<string>`coalesce((select sum(r.pendientes) from resumen_importacion_historica r where r.lote_id = l.id), 0)`.as('pendientes'),
] as const;

type FilaLoteDb = {
  id: string;
  sistema: string;
  sha256: string;
  conteos_esperados: unknown;
  creado_por_login: string | null;
  creado_en: Date;
  estado: string;
  sellado_en: Date | null;
  cerrado_en: Date | null;
  cargadas: string;
  pendientes: string;
};

function aFilaLote(f: FilaLoteDb): FilaLote {
  return {
    ...f,
    conteos_esperados: (f.conteos_esperados ?? {}) as Record<string, number>,
    creado_en: f.creado_en.toISOString(),
    sellado_en: f.sellado_en ? f.sellado_en.toISOString() : null,
    cerrado_en: f.cerrado_en ? f.cerrado_en.toISOString() : null,
    cargadas: Number(f.cargadas),
    pendientes: Number(f.pendientes),
  };
}

export async function listarLotes(filtros: { q?: string; estado?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('lotes_importacion as l').leftJoin('usuarios as u', 'u.id', 'l.creado_por');
    if (filtros.estado) q = q.where('l.estado', '=', filtros.estado);
    if (filtros.q) q = q.where('l.sistema', 'ilike', `%${filtros.q}%`);
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(base().select([...columnasLote]).orderBy('l.id', 'desc'), p).execute();
  return { filas: filas.map((f) => aFilaLote(f as FilaLoteDb)), total: Number(total.n) };
}

export async function obtenerLote(id: string): Promise<FilaLote | null> {
  const f = await db()
    .selectFrom('lotes_importacion as l')
    .leftJoin('usuarios as u', 'u.id', 'l.creado_por')
    .select([...columnasLote])
    .where('l.id', '=', id)
    .executeTakeFirst();
  return f ? aFilaLote(f as FilaLoteDb) : null;
}

export async function resumenLote(loteId: string): Promise<FilaResumenImportacion[]> {
  const filas = await db()
    .selectFrom('resumen_importacion_historica')
    .select(['entidad', 'cargadas', 'creadas', 'vinculadas', 'archivadas', 'excluidas', 'pendientes'])
    .where('lote_id', '=', loteId)
    .orderBy('entidad')
    .execute();
  return filas.map((f) => ({
    entidad: f.entidad ?? '',
    cargadas: Number(f.cargadas ?? 0),
    creadas: Number(f.creadas ?? 0),
    vinculadas: Number(f.vinculadas ?? 0),
    archivadas: Number(f.archivadas ?? 0),
    excluidas: Number(f.excluidas ?? 0),
    pendientes: Number(f.pendientes ?? 0),
  }));
}

export async function avanzarLote(loteId: string, actorId: string): Promise<string> {
  const r = await sql<{ estado: string }>`select avanzar_lote_historico(${loteId}::bigint, ${actorId}::bigint) as estado`.execute(db());
  return r.rows[0]?.estado ?? '';
}

export async function conciliarFila(d: {
  loteId: string;
  entidad: string;
  claveOrigen: string;
  actorId: string;
  accion: string;
  motivo: string;
  destinoId?: string;
  codigo?: string;
  personaExistenteId?: string;
}) {
  const r = await sql<{ accion: string; destino_id: string | null }>`
    select c.accion, c.destino_id
    from conciliar_fila_historica(
      ${d.loteId}::bigint, ${d.entidad}, ${d.claveOrigen}, ${d.actorId}::bigint, ${d.accion}, ${d.motivo},
      ${d.destinoId ?? null}::bigint, ${d.codigo ?? null}::text, ${d.personaExistenteId ?? null}::bigint
    ) c
  `.execute(db());
  const fila = r.rows[0];
  if (!fila) throw new Error('conciliar_fila_historica no devolvió la conciliación');
  return fila;
}

export async function clavesPendientes(loteId: string, entidad: string): Promise<string[]> {
  const filas = await db()
    .selectFrom('filas_importacion as f')
    .leftJoin('conciliaciones_historicas as c', (j) =>
      j.onRef('c.lote_id', '=', 'f.lote_id').onRef('c.entidad', '=', 'f.entidad').onRef('c.clave_origen', '=', 'f.clave_origen'),
    )
    .select('f.clave_origen')
    .where('f.lote_id', '=', loteId)
    .where('f.entidad', '=', entidad)
    .where('c.accion', 'is', null)
    .orderBy('f.clave_origen')
    .execute();
  return filas.map((f) => f.clave_origen);
}

export async function listarFilas(loteId: string, filtros: { q?: string; entidad?: string; estado?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('filas_importacion as f')
      .leftJoin('conciliaciones_historicas as c', (j) =>
        j.onRef('c.lote_id', '=', 'f.lote_id').onRef('c.entidad', '=', 'f.entidad').onRef('c.clave_origen', '=', 'f.clave_origen'),
      )
      .where('f.lote_id', '=', loteId);
    if (filtros.entidad) q = q.where('f.entidad', '=', filtros.entidad);
    if (filtros.estado === 'pendiente') q = q.where('c.accion', 'is', null);
    else if (filtros.estado === 'conciliada') q = q.where('c.accion', 'is not', null);
    else if (filtros.estado) q = q.where('c.accion', '=', filtros.estado);
    if (filtros.q) {
      const texto = `%${filtros.q}%`;
      q = q.where((eb) => eb.or([eb('f.clave_origen', 'ilike', texto), eb(sql<string>`f.datos::text`, 'ilike', texto)]));
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('usuarios as u', 'u.id', 'c.revisada_por')
      .select(['f.entidad', 'f.clave_origen', 'f.datos', 'c.accion', 'c.destino_id', 'c.motivo', 'c.revisada_en', 'u.login as revisada_por_login'])
      .orderBy('f.entidad')
      .orderBy(sql`length(f.clave_origen)`)
      .orderBy('f.clave_origen'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaImportacionVista => ({
        ...f,
        datos: (f.datos ?? {}) as Record<string, unknown>,
        revisada_en: f.revisada_en ? f.revisada_en.toISOString() : null,
      }),
    ),
    total: Number(total.n),
  };
}

export async function listarArchivoHistorico(filtros: { q?: string; sistema?: string; entidad?: string; loteId?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('archivo_historico as h');
    if (filtros.sistema) q = q.where('h.sistema', '=', filtros.sistema);
    if (filtros.entidad) q = q.where('h.entidad', '=', filtros.entidad);
    if (filtros.loteId) q = q.where('h.lote_id', '=', filtros.loteId);
    if (filtros.q) {
      const texto = `%${filtros.q}%`;
      q = q.where((eb) => eb.or([eb('h.clave_origen', 'ilike', texto), eb(sql<string>`h.datos::text`, 'ilike', texto)]));
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select(['h.sistema', sql<string>`encode(h.sha256, 'hex')`.as('sha256'), 'h.lote_id', 'h.entidad', 'h.clave_origen', 'h.datos', 'h.motivo', 'h.revisada_en'])
      .orderBy('h.revisada_en', 'desc')
      .orderBy('h.clave_origen'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaArchivoHistorico => ({
        sistema: f.sistema ?? '',
        sha256: f.sha256,
        lote_id: f.lote_id ?? '',
        entidad: f.entidad ?? '',
        clave_origen: f.clave_origen ?? '',
        datos: (f.datos ?? {}) as Record<string, unknown>,
        motivo: f.motivo ?? '',
        revisada_en: f.revisada_en ? f.revisada_en.toISOString() : '',
      }),
    ),
    total: Number(total.n),
  };
}

export async function sistemasImportados(): Promise<string[]> {
  const filas = await db().selectFrom('lotes_importacion').select('sistema').distinct().orderBy('sistema').execute();
  return filas.map((f) => f.sistema);
}
