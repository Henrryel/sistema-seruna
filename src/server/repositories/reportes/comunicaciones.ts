import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaComunicacion, OpcionDocumentoInstitucional } from '@/esquemas/reportes/comunicaciones';

// Comunicaciones de documentos institucionales (comunicaciones_documento). El CHECK exige destinatario o alcance.

export async function listarComunicaciones(filtros: { q?: string; documentoId?: string; canal?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('comunicaciones_documento as c')
      .innerJoin('documentos_institucionales as di', 'di.id', 'c.documento_id')
      .innerJoin('anios_academicos as a', 'a.id', 'di.anio_id')
      .leftJoin('personas as p', 'p.id', 'c.destinatario_id');
    if (filtros.documentoId) q = q.where('c.documento_id', '=', filtros.documentoId);
    if (filtros.canal) q = q.where('c.canal', '=', filtros.canal);
    if (filtros.q) {
      const texto = `%${filtros.q}%`;
      q = q.where((eb) => eb.or([eb('c.alcance', 'ilike', texto), eb(sql<string>`p.apellidos || ', ' || p.nombres`, 'ilike', texto)]));
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('archivos as ar', 'ar.id', 'c.evidencia_id')
      .leftJoin('usuarios as u', 'u.id', 'c.registrado_por')
      .select([
        'c.id',
        'c.documento_id',
        'di.tipo as documento_tipo',
        'di.version as documento_version',
        'a.anio',
        'c.destinatario_id',
        sql<string | null>`case when p.id is null then null else p.apellidos || ', ' || p.nombres end`.as('destinatario'),
        'c.alcance',
        'c.comunicado_en',
        'c.canal',
        'c.evidencia_id',
        'ar.nombre_original as evidencia_nombre',
        'u.login as registrado_por_login',
      ])
      .orderBy('c.comunicado_en', 'desc')
      .orderBy('c.id', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaComunicacion => ({ ...f, comunicado_en: f.comunicado_en.toISOString() })),
    total: Number(total.n),
  };
}

export async function crearComunicacion(d: {
  documentoId: string;
  destinatarioId: string | null;
  alcance: string | null;
  comunicadoEn: string;
  canal: string;
  evidenciaId: string | null;
  registradoPor: string;
}) {
  return db()
    .insertInto('comunicaciones_documento')
    .values({
      documento_id: d.documentoId,
      destinatario_id: d.destinatarioId,
      alcance: d.alcance,
      comunicado_en: d.comunicadoEn,
      canal: d.canal,
      evidencia_id: d.evidenciaId,
      registrado_por: d.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function obtenerComunicacion(id: string) {
  return db().selectFrom('comunicaciones_documento').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function documentosInstitucionales(): Promise<OpcionDocumentoInstitucional[]> {
  const filas = await db()
    .selectFrom('documentos_institucionales as di')
    .innerJoin('anios_academicos as a', 'a.id', 'di.anio_id')
    .select(['di.id', 'di.tipo', 'di.version', 'a.anio', 'di.publicado_en', 'di.vigente_desde'])
    .orderBy('a.anio', 'desc')
    .orderBy('di.tipo')
    .orderBy('di.version', 'desc')
    .execute();
  return filas.map((f) => ({ ...f, publicado_en: f.publicado_en ? f.publicado_en.toISOString() : null }));
}

/** Búsqueda de personas por nombres, apellidos o número de documento de identidad. */
export async function buscarPersonas(q: string) {
  const texto = `%${q}%`;
  return db()
    .selectFrom('personas as p')
    .select([
      'p.id',
      'p.nombres',
      'p.apellidos',
      sql<string | null>`(select d.tipo || ' ' || d.numero from documentos_identidad d where d.persona_id = p.id order by d.id limit 1)`.as('documento'),
    ])
    .where((eb) =>
      eb.or([
        eb(sql<string>`p.apellidos || ', ' || p.nombres`, 'ilike', texto),
        eb(sql<string>`p.nombres || ' ' || p.apellidos`, 'ilike', texto),
        eb.exists(eb.selectFrom('documentos_identidad as d').select('d.id').whereRef('d.persona_id', '=', 'p.id').where('d.numero', 'like', `${q}%`)),
      ]),
    )
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .limit(20)
    .execute();
}
