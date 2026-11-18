import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { Json } from '@/server/db/tipos';
import type { FilaPlantilla, OpcionPlantilla } from '@/esquemas/reportes/plantillas';

// Plantillas de documento (plantillas_documento). La inmutabilidad al publicar la impone el trigger
// `proteger_plantilla_publicada`; los CHECK validan formato, versión y configuración.

/** jsonb seguro: siempre se envía el texto JSON y se convierte en la base. */
export const jsonb = (valor: unknown) => sql<Json>`${JSON.stringify(valor)}::jsonb`;

export async function tiposReporte() {
  return db().selectFrom('tipos_reporte').select(['codigo', 'nombre', 'permiso']).orderBy('nombre').execute();
}

export async function listarPlantillas(
  filtros: { q?: string; anioId?: string; tipo?: string; formato?: string; estado?: 'borrador' | 'publicada' },
  p: Paginacion | null,
) {
  const base = () => {
    let q = db()
      .selectFrom('plantillas_documento as pd')
      .innerJoin('tipos_reporte as t', 't.codigo', 'pd.tipo')
      .innerJoin('anios_academicos as a', 'a.id', 'pd.anio_id');
    if (filtros.anioId) q = q.where('pd.anio_id', '=', filtros.anioId);
    if (filtros.tipo) q = q.where('pd.tipo', '=', filtros.tipo);
    if (filtros.formato) q = q.where('pd.formato', '=', filtros.formato);
    if (filtros.estado === 'borrador') q = q.where('pd.publicada_en', 'is', null);
    if (filtros.estado === 'publicada') q = q.where('pd.publicada_en', 'is not', null);
    if (filtros.q) q = q.where((eb) => eb.or([eb('pd.nombre', 'ilike', `%${filtros.q}%`), eb('t.nombre', 'ilike', `%${filtros.q}%`)]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('archivos as ar', 'ar.id', 'pd.archivo_id')
      .leftJoin('usuarios as u', 'u.id', 'pd.creada_por')
      .select((eb) => [
        'pd.id',
        'pd.tipo',
        't.nombre as tipo_nombre',
        'pd.anio_id',
        'a.anio',
        'pd.formato',
        'pd.version',
        'pd.nombre',
        'pd.archivo_id',
        'ar.nombre_original as archivo_nombre',
        'pd.configuracion',
        'pd.creada_por',
        'u.login as creada_por_login',
        'pd.creada_en',
        'pd.publicada_en',
        eb
          .selectFrom('documentos_emitidos as d')
          .select((e) => e.fn.countAll<string>().as('n'))
          .whereRef('d.plantilla_id', '=', 'pd.id')
          .as('documentos'),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy('t.nombre')
      .orderBy('pd.formato')
      .orderBy('pd.version', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaPlantilla => ({
        ...f,
        configuracion: (f.configuracion ?? {}) as Record<string, unknown>,
        creada_en: f.creada_en.toISOString(),
        publicada_en: f.publicada_en ? f.publicada_en.toISOString() : null,
        documentos: Number(f.documentos ?? 0),
      }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerPlantilla(id: string) {
  return db().selectFrom('plantillas_documento').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function siguienteVersion(tipo: string, anioId: string, formato: string): Promise<number> {
  const r = await db()
    .selectFrom('plantillas_documento')
    .select((eb) => eb.fn.max('version').as('max'))
    .where('tipo', '=', tipo)
    .where('anio_id', '=', anioId)
    .where('formato', '=', formato)
    .executeTakeFirst();
  return Number(r?.max ?? 0) + 1;
}

export async function crearPlantilla(d: {
  tipo: string;
  anioId: string;
  formato: string;
  version: number;
  nombre: string;
  archivoId: string | null;
  configuracion: unknown;
  creadaPor: string;
}) {
  return db()
    .insertInto('plantillas_documento')
    .values({
      tipo: d.tipo,
      anio_id: d.anioId,
      formato: d.formato,
      version: d.version,
      nombre: d.nombre,
      archivo_id: d.archivoId,
      configuracion: jsonb(d.configuracion),
      creada_por: d.creadaPor,
    })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow();
}

/** Edita una plantilla. Si está publicada, el trigger lo rechaza ("Cree una versión nueva…"). */
export async function actualizarPlantilla(
  id: string,
  d: { tipo: string; anioId: string; formato: string; version: number; nombre: string; configuracion: unknown; archivoId?: string | null },
) {
  return db()
    .updateTable('plantillas_documento')
    .set({
      tipo: d.tipo,
      anio_id: d.anioId,
      formato: d.formato,
      version: d.version,
      nombre: d.nombre,
      configuracion: jsonb(d.configuracion),
      ...(d.archivoId !== undefined ? { archivo_id: d.archivoId } : {}),
    })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

/** Publica (clock_timestamp para respetar publicada_en >= creada_en). Republicar lo rechaza el trigger. */
export async function publicarPlantilla(id: string) {
  return db()
    .updateTable('plantillas_documento')
    .set({ publicada_en: sql`clock_timestamp()` })
    .where('id', '=', id)
    .returning(['id', 'publicada_en'])
    .executeTakeFirst();
}

/** Plantillas publicadas de los tipos indicados, para solicitar documentos. */
export async function plantillasPublicadas(tipos: string[]): Promise<OpcionPlantilla[]> {
  if (tipos.length === 0) return [];
  const filas = await db()
    .selectFrom('plantillas_documento as pd')
    .innerJoin('tipos_reporte as t', 't.codigo', 'pd.tipo')
    .innerJoin('anios_academicos as a', 'a.id', 'pd.anio_id')
    .select([
      'pd.id',
      'pd.tipo',
      't.nombre as tipo_nombre',
      'pd.anio_id',
      'a.anio',
      'a.inicio as anio_inicio',
      'a.fin as anio_fin',
      'pd.formato',
      'pd.version',
      'pd.nombre',
    ])
    .where('pd.publicada_en', 'is not', null)
    .where(sql<boolean>`pd.publicada_en <= clock_timestamp()`)
    .where('pd.tipo', 'in', tipos)
    .orderBy('a.anio', 'desc')
    .orderBy('t.nombre')
    .orderBy('pd.formato')
    .orderBy('pd.version', 'desc')
    .execute();
  return filas;
}
