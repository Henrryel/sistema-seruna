import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaDocumentoInstitucional } from '@/esquemas/matricula/documentos';
import { iso, patronLike } from './personas';

export async function listarDocumentosInstitucionales(filtros: { q?: string; anioId?: string; tipo?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('documentos_institucionales as d')
      .innerJoin('anios_academicos as a', 'a.id', 'd.anio_id')
      .innerJoin('archivos as ar', 'ar.id', 'd.archivo_id');
    if (filtros.anioId) q = q.where('d.anio_id', '=', filtros.anioId);
    if (filtros.tipo) q = q.where('d.tipo', '=', filtros.tipo);
    if (filtros.q) q = q.where('ar.nombre_original', 'ilike', patronLike(filtros.q));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        'd.id',
        'd.anio_id',
        'a.anio',
        'd.tipo',
        'd.version',
        'd.archivo_id',
        'ar.nombre_original as nombre_archivo',
        'ar.bytes',
        'd.vigente_desde',
        'd.publicado_en',
        eb.selectFrom('aceptaciones_documento as ac').select((e) => e.fn.countAll<string>().as('n')).whereRef('ac.documento_id', '=', 'd.id').as('aceptaciones'),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy('d.tipo')
      .orderBy('d.version', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaDocumentoInstitucional => ({
        ...f,
        bytes: Number(f.bytes),
        publicado_en: iso(f.publicado_en),
        aceptaciones: Number(f.aceptaciones ?? 0),
      }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerDocumentoInstitucional(id: string) {
  return db().selectFrom('documentos_institucionales').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function siguienteVersionDocumento(anioId: string, tipo: string) {
  const f = await db()
    .selectFrom('documentos_institucionales')
    .select(sql<number>`coalesce(max(version), 0) + 1`.as('v'))
    .where('anio_id', '=', anioId)
    .where('tipo', '=', tipo)
    .executeTakeFirstOrThrow();
  return Number(f.v);
}

export async function crearDocumentoInstitucional(d: { anioId: string; tipo: string; version: number; archivoId: string; vigenteDesde: string | null }) {
  return db()
    .insertInto('documentos_institucionales')
    .values({ anio_id: d.anioId, tipo: d.tipo, version: d.version, archivo_id: d.archivoId, vigente_desde: d.vigenteDesde })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow();
}

export async function publicarDocumentoInstitucional(id: string, vigenteDesde: string | null) {
  return db()
    .updateTable('documentos_institucionales')
    .set((eb) => ({
      publicado_en: sql<Date>`now()`,
      vigente_desde: vigenteDesde ?? eb.ref('vigente_desde'),
    }))
    .where('id', '=', id)
    .where('publicado_en', 'is', null)
    .returning(['id'])
    .executeTakeFirst();
}

/** Documentos publicados del año (para aceptaciones). */
export async function documentosPublicadosDelAnio(anioId: string) {
  return db()
    .selectFrom('documentos_institucionales')
    .select(['id', 'tipo', 'version', 'vigente_desde'])
    .where('anio_id', '=', anioId)
    .where('publicado_en', 'is not', null)
    .orderBy('tipo')
    .orderBy('version', 'desc')
    .execute();
}

/** ¿Qué registro del módulo referencia el archivo? (para autorizar su descarga). */
export async function referenciasArchivo(archivoId: string) {
  const f = await db()
    .selectNoFrom([
      sql<boolean>`exists(select 1 from documentos_expediente where archivo_id = ${archivoId})`.as('expediente'),
      sql<boolean>`exists(select 1 from documentos_institucionales where archivo_id = ${archivoId})`.as('institucional'),
      sql<boolean>`exists(select 1 from estudiante_apoderado where evidencia_id = ${archivoId})
        or exists(select 1 from movimientos_matricula where evidencia_id = ${archivoId})
        or exists(select 1 from aceptaciones_documento where evidencia_id = ${archivoId})`.as('evidencia'),
    ])
    .executeTakeFirstOrThrow();
  return f;
}
