import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaDocumento, ParametrosDocumento, ResumenColaDocumentos } from '@/esquemas/reportes/documentos';

// Cola de documentos (documentos_emitidos). La solicitud la crea `preparar_documento_reporte` (permiso,
// filtros, datos congelados, idempotencia); las transiciones las protege el trigger `proteger_documento_emitido`
// y la bitácora la escribe `auditar_documento_reporte`.

export interface FiltrosDocumentos {
  usuarioId: string;
  /** Tipos cuyo permiso tiene el actor: ve esos documentos además de los que solicitó. */
  tiposPermitidos: string[];
  estado?: string;
  tipo?: string;
  anioId?: string;
  soloPropios?: boolean;
  q?: string;
}

export async function prepararDocumento(d: {
  uuid: string;
  plantillaId: string;
  actorId: string;
  desde: string;
  hasta: string;
  matriculaId?: string;
  seccionId?: string;
  bimestreId?: string;
}) {
  const r = await sql<{ id: string; estado: string; solicitud_uuid: string }>`
    select d.id, d.estado, d.solicitud_uuid
    from preparar_documento_reporte(
      ${d.uuid}::uuid, ${d.plantillaId}::bigint, ${d.actorId}::bigint, ${d.desde}::date, ${d.hasta}::date,
      ${d.matriculaId ?? null}::bigint, ${d.seccionId ?? null}::bigint, ${d.bimestreId ?? null}::bigint
    ) d
  `.execute(db());
  const fila = r.rows[0];
  if (!fila) throw new Error('preparar_documento_reporte no devolvió la solicitud');
  return fila;
}

function visibles(f: FiltrosDocumentos) {
  let q = db()
    .selectFrom('documentos_emitidos as d')
    .innerJoin('plantillas_documento as pd', 'pd.id', 'd.plantilla_id')
    .innerJoin('tipos_reporte as t', 't.codigo', 'd.tipo')
    .innerJoin('anios_academicos as a', 'a.id', 'd.anio_id');
  q = f.soloPropios || f.tiposPermitidos.length === 0
    ? q.where('d.solicitado_por', '=', f.usuarioId)
    : q.where((eb) => eb.or([eb('d.solicitado_por', '=', f.usuarioId), eb('d.tipo', 'in', f.tiposPermitidos)]));
  return q;
}

export async function listarDocumentos(f: FiltrosDocumentos, p: Paginacion | null) {
  const base = () => {
    let q = visibles(f);
    if (f.estado) q = q.where('d.estado', '=', f.estado);
    if (f.tipo) q = q.where('d.tipo', '=', f.tipo);
    if (f.anioId) q = q.where('d.anio_id', '=', f.anioId);
    if (f.q) {
      const texto = `%${f.q}%`;
      q = q.where((eb) => eb.or([eb('pd.nombre', 'ilike', texto), eb('t.nombre', 'ilike', texto), eb(sql<string>`d.solicitud_uuid::text`, 'ilike', texto)]));
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('usuarios as u', 'u.id', 'd.solicitado_por')
      .leftJoin('archivos as ar', 'ar.id', 'd.archivo_id')
      .select([
        'd.id',
        'd.solicitud_uuid',
        'd.plantilla_id',
        'pd.nombre as plantilla_nombre',
        'pd.version as plantilla_version',
        'd.tipo',
        't.nombre as tipo_nombre',
        'a.anio',
        'd.formato',
        'd.parametros',
        sql<string>`jsonb_array_length(coalesce(d.datos -> 'filas', '[]'::jsonb))`.as('filas'),
        'd.estado',
        'd.solicitado_por',
        'u.login as solicitado_por_login',
        'd.solicitado_en',
        'd.procesado_en',
        'd.motivo_fallo',
        'd.anulado_en',
        'd.motivo_anulacion',
        'd.archivo_id',
        'ar.bytes as archivo_bytes',
      ])
      .orderBy('d.id', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (x): FilaDocumento => ({
        ...x,
        parametros: x.parametros as unknown as ParametrosDocumento,
        filas: Number(x.filas),
        solicitado_en: x.solicitado_en.toISOString(),
        procesado_en: x.procesado_en ? x.procesado_en.toISOString() : null,
        anulado_en: x.anulado_en ? x.anulado_en.toISOString() : null,
        archivo_bytes: x.archivo_bytes === null ? null : Number(x.archivo_bytes),
        puedeGestionar: x.solicitado_por === f.usuarioId || f.tiposPermitidos.includes(x.tipo),
      }),
    ),
    total: Number(total.n),
  };
}

export async function resumenCola(f: FiltrosDocumentos): Promise<ResumenColaDocumentos> {
  const filas = await visibles(f)
    .select((eb) => ['d.estado', eb.fn.countAll<string>().as('n')])
    .groupBy('d.estado')
    .execute();
  const r: ResumenColaDocumentos = { preparado: 0, emitido: 0, fallido: 0, anulado: 0 };
  for (const x of filas) if (x.estado in r) r[x.estado as keyof ResumenColaDocumentos] = Number(x.n);
  return r;
}

export async function obtenerDocumento(id: string) {
  return db()
    .selectFrom('documentos_emitidos as d')
    .innerJoin('plantillas_documento as pd', 'pd.id', 'd.plantilla_id')
    .innerJoin('tipos_reporte as t', 't.codigo', 'd.tipo')
    .innerJoin('anios_academicos as a', 'a.id', 'd.anio_id')
    .select([
      'd.id',
      'd.solicitud_uuid',
      'd.tipo',
      't.nombre as tipo_nombre',
      't.permiso',
      'd.anio_id',
      'a.anio',
      'd.formato',
      'd.parametros',
      'd.datos',
      'd.estado',
      'd.solicitado_por',
      'd.solicitado_en',
      'd.archivo_id',
      'd.procesado_por',
      'd.procesado_en',
      'd.motivo_fallo',
      'pd.id as plantilla_id',
      'pd.nombre as plantilla_nombre',
      'pd.version as plantilla_version',
      'pd.configuracion',
      'pd.archivo_id as plantilla_archivo_id',
    ])
    .where('d.id', '=', id)
    .executeTakeFirst();
}

export type DocumentoCompleto = NonNullable<Awaited<ReturnType<typeof obtenerDocumento>>>;

/** Toma (bloquea) la solicitud preparada más antigua sin esperar a otros procesos (SKIP LOCKED). */
export async function tomarSiguientePreparado(soloIds?: string[]): Promise<string | null> {
  let q = db().selectFrom('documentos_emitidos').select('id').where('estado', '=', 'preparado');
  if (soloIds) {
    if (soloIds.length === 0) return null;
    q = q.where('id', 'in', soloIds);
  }
  const fila = await q.orderBy('id').limit(1).forUpdate().skipLocked().executeTakeFirst();
  return fila?.id ?? null;
}

export async function marcarEmitido(id: string, archivoId: string, procesadoPor: string) {
  return db()
    .updateTable('documentos_emitidos')
    .set({ estado: 'emitido', archivo_id: archivoId, procesado_por: procesadoPor, procesado_en: sql`clock_timestamp()` })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

export async function marcarFallido(id: string, procesadoPor: string, motivo: string) {
  return db()
    .updateTable('documentos_emitidos')
    .set({ estado: 'fallido', procesado_por: procesadoPor, procesado_en: sql`clock_timestamp()`, motivo_fallo: motivo })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

/** emitido → anulado (cualquier otra transición la rechaza el trigger). */
export async function anularDocumento(id: string, actorId: string, motivo: string) {
  return db()
    .updateTable('documentos_emitidos')
    .set({ estado: 'anulado', anulado_por: actorId, anulado_en: sql`clock_timestamp()`, motivo_anulacion: motivo })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

/** Nombres legibles de los filtros de una solicitud (para el subtítulo del documento). */
export async function describirFiltros(p: { matriculaId?: string | null; seccionId?: string | null; bimestreId?: string | null }) {
  const [matricula, seccion, bimestre] = await Promise.all([
    p.matriculaId
      ? db()
          .selectFrom('matriculas as m')
          .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
          .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
          .select(['e.codigo', 'pe.nombres', 'pe.apellidos'])
          .where('m.id', '=', p.matriculaId)
          .executeTakeFirst()
      : undefined,
    p.seccionId
      ? db()
          .selectFrom('secciones as s')
          .innerJoin('grados as g', 'g.id', 's.grado_id')
          .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
          .select(['s.nombre', 'g.numero', 'n.nombre as nivel'])
          .where('s.id', '=', p.seccionId)
          .executeTakeFirst()
      : undefined,
    p.bimestreId ? db().selectFrom('bimestres').select('numero').where('id', '=', p.bimestreId).executeTakeFirst() : undefined,
  ]);
  return {
    estudiante: matricula ? `${matricula.apellidos}, ${matricula.nombres} (${matricula.codigo})` : null,
    seccion: seccion ? `${seccion.numero}.º ${seccion.nombre} ${seccion.nivel}` : null,
    bimestre: bimestre ? bimestre.numero : null,
  };
}

/** Matrículas del año para el filtro de reportes (búsqueda por apellidos, nombres o código). */
export async function buscarMatriculas(anioId: string, q?: string) {
  let consulta = db()
    .selectFrom('matriculas as m')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .innerJoin('grados as g', 'g.id', 'm.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([
      'm.id',
      'm.estado',
      'e.codigo',
      'p.nombres',
      'p.apellidos',
      'g.numero as grado',
      'n.nombre as nivel',
      sql<string | null>`(select s.nombre from matricula_secciones ms join secciones s on s.id = ms.seccion_id
        where ms.matricula_id = m.id order by lower(ms.vigencia) desc limit 1)`.as('seccion'),
    ])
    .where('m.anio_id', '=', anioId)
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .limit(30);
  if (q) {
    const texto = `%${q}%`;
    consulta = consulta.where((eb) =>
      eb.or([eb('p.apellidos', 'ilike', texto), eb('p.nombres', 'ilike', texto), eb('e.codigo', 'ilike', texto), eb(sql<string>`p.nombres || ' ' || p.apellidos`, 'ilike', texto)]),
    );
  }
  return consulta.execute();
}
