import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { ExportacionFila, FilaPlantilla, MapeoFila } from '@/esquemas/evaluacion/siagie';

// Plantillas, mapeos y exportaciones SIAGIE. El contenido de la exportación lo arma la base
// (`preparar_exportacion_siagie`), que exige el bimestre publicado, mapeos y códigos SIAGIE completos.

function base() {
  return db()
    .selectFrom('plantillas_siagie as pl')
    .innerJoin('secciones as s', 's.id', 'pl.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('bimestres as b', 'b.id', 'pl.bimestre_id')
    .innerJoin('anios_academicos as a', 'a.id', 'pl.anio_id')
    .innerJoin('archivos as f', 'f.id', 'pl.archivo_id');
}

function seleccion(q: ReturnType<typeof base>) {
  return q.select([
    'pl.id',
    'pl.seccion_id',
    's.nombre as seccion',
    'g.numero as grado',
    'n.nombre as nivel',
    'pl.bimestre_id',
    'b.numero as bimestre',
    'a.anio',
    'pl.version',
    'pl.archivo_id',
    'f.nombre_original as archivo',
    sql<string>`(select count(*) from mapeos_siagie x where x.plantilla_id = pl.id)`.as('mapeos'),
    sql<string>`(select count(*) from exportaciones_siagie x where x.plantilla_id = pl.id)`.as('exportaciones'),
    sql<string | null>`(select x.estado from cierres_evaluacion x where x.seccion_id = pl.seccion_id and x.bimestre_id = pl.bimestre_id)`.as('cierre_estado'),
  ]);
}

const aFila = (f: Awaited<ReturnType<ReturnType<typeof seleccion>['execute']>>[number]): FilaPlantilla => ({
  ...f,
  mapeos: Number(f.mapeos ?? 0),
  exportaciones: Number(f.exportaciones ?? 0),
});

export async function listarPlantillas(filtros: { anioId?: string; seccionId?: string; bimestreId?: string; q?: string }, p: Paginacion | null) {
  const filtrar = (q: ReturnType<typeof base>) => {
    let r = q;
    if (filtros.anioId) r = r.where('pl.anio_id', '=', filtros.anioId);
    if (filtros.seccionId) r = r.where('pl.seccion_id', '=', filtros.seccionId);
    if (filtros.bimestreId) r = r.where('pl.bimestre_id', '=', filtros.bimestreId);
    if (filtros.q) r = r.where((eb) => eb.or([eb('s.nombre', 'ilike', `%${filtros.q}%`), eb('f.nombre_original', 'ilike', `%${filtros.q}%`)]));
    return r;
  };
  const total = await filtrar(base()).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    seleccion(filtrar(base())).orderBy('a.anio', 'desc').orderBy('b.numero').orderBy('g.nivel_id').orderBy('g.numero').orderBy('s.nombre').orderBy('pl.version', 'desc'),
    p,
  ).execute();
  return { filas: filas.map(aFila), total: Number(total.n) };
}

export async function obtenerPlantilla(id: string) {
  const f = await seleccion(base()).select(['pl.anio_id', 'pl.grado_id']).where('pl.id', '=', id).executeTakeFirst();
  return f ? { ...aFila(f), anio_id: f.anio_id, grado_id: f.grado_id } : undefined;
}

export async function crearPlantilla(d: { archivoId: string; seccionId: string; bimestreId: string; anioId: string; gradoId: string }) {
  return db()
    .insertInto('plantillas_siagie')
    .values({
      archivo_id: d.archivoId,
      seccion_id: d.seccionId,
      bimestre_id: d.bimestreId,
      anio_id: d.anioId,
      grado_id: d.gradoId,
      version: sql<number>`(select coalesce(max(version), 0) + 1 from plantillas_siagie where seccion_id = ${d.seccionId} and bimestre_id = ${d.bimestreId})`,
    })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow();
}

/** Otras plantillas del mismo año y grado con mapeos (para copiar el mapeo). */
export async function otrasPlantillas(id: string, anioId: string, gradoId: string) {
  return seleccion(base())
    .where('pl.anio_id', '=', anioId)
    .where('pl.grado_id', '=', gradoId)
    .where('pl.id', '<>', id)
    .where(({ exists, selectFrom }) => exists(selectFrom('mapeos_siagie as x').select('x.id').whereRef('x.plantilla_id', '=', 'pl.id')))
    .orderBy('b.numero', 'desc')
    .orderBy('pl.version', 'desc')
    .limit(50)
    .execute();
}

export async function mapeosDe(plantillaId: string): Promise<MapeoFila[]> {
  return db()
    .selectFrom('mapeos_siagie as x')
    .innerJoin('competencias as k', 'k.id', 'x.competencia_id')
    .select(['x.id', 'x.competencia_id', 'k.nombre as competencia', 'k.codigo as codigo_competencia', 'x.hoja', 'x.codigo_excel', 'x.columna_nl', 'x.columna_conclusion'])
    .where('x.plantilla_id', '=', plantillaId)
    .orderBy('x.hoja')
    .orderBy('x.columna_nl')
    .execute();
}

export async function insertarMapeo(plantillaId: string, d: { competenciaId: string; hoja: string; codigoExcel: string; columnaNl: number }) {
  return db()
    .insertInto('mapeos_siagie')
    .values({
      plantilla_id: plantillaId,
      competencia_id: d.competenciaId,
      hoja: d.hoja,
      codigo_excel: d.codigoExcel,
      columna_nl: d.columnaNl,
      // La base exige recibir la columna de conclusión ya calculada: siempre la siguiente al nivel de logro.
      columna_conclusion: d.columnaNl + 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
}

export async function eliminarMapeo(plantillaId: string, mapeoId: string) {
  return db().deleteFrom('mapeos_siagie').where('plantilla_id', '=', plantillaId).where('id', '=', mapeoId).returning('id').executeTakeFirst();
}

/** Copia los mapeos de otra plantilla (omite competencias ya mapeadas). */
export async function copiarMapeos(desdeId: string, haciaId: string) {
  return db()
    .insertInto('mapeos_siagie')
    .columns(['plantilla_id', 'competencia_id', 'hoja', 'codigo_excel', 'columna_nl', 'columna_conclusion'])
    .expression(
      db()
        .selectFrom('mapeos_siagie as x')
        .select([sql<string>`${haciaId}::bigint`.as('plantilla_id'), 'x.competencia_id', 'x.hoja', 'x.codigo_excel', 'x.columna_nl', 'x.columna_conclusion'])
        .where('x.plantilla_id', '=', desdeId)
        .where(({ not, exists, selectFrom }) =>
          not(exists(selectFrom('mapeos_siagie as y').select('y.id').where('y.plantilla_id', '=', haciaId).whereRef('y.competencia_id', '=', 'x.competencia_id'))),
        ),
    )
    .returning('id')
    .execute();
}

export async function exportacionesDe(plantillaId: string): Promise<ExportacionFila[]> {
  const filas = await db()
    .selectFrom('exportaciones_siagie as x')
    .innerJoin('usuarios as u', 'u.id', 'x.solicitado_por')
    .select([
      'x.id',
      'x.estado',
      'x.solicitado_en',
      'u.login as solicitado_por',
      'x.observacion',
      'x.resultado_archivo_id',
      sql<string>`coalesce(jsonb_array_length(x.contenido -> 'notas'), 0)`.as('notas'),
    ])
    .where('x.plantilla_id', '=', plantillaId)
    .orderBy('x.solicitado_en', 'desc')
    .orderBy('x.id', 'desc')
    .execute();
  return filas.map((f) => ({ ...f, estado: f.estado as ExportacionFila['estado'], solicitado_en: f.solicitado_en.toISOString(), notas: Number(f.notas) }));
}

/** Llama a la función de la base que valida y arma el contenido de la exportación. */
export async function prepararExportacion(plantillaId: string, usuarioId: string) {
  const r = await sql<{ id: string; estado: string }>`
    select id, estado from preparar_exportacion_siagie(${plantillaId}::bigint, ${usuarioId}::bigint)`.execute(db());
  const fila = r.rows[0];
  if (!fila) throw new Error('preparar_exportacion_siagie no devolvió la exportación');
  return { id: String(fila.id), estado: fila.estado };
}

export async function obtenerExportacion(id: string) {
  return db()
    .selectFrom('exportaciones_siagie')
    .select(['id', 'plantilla_id', 'seccion_id', 'bimestre_id', 'estado', 'contenido', 'resultado_archivo_id', 'observacion'])
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function marcarGenerada(id: string, archivoId: string, observacion: string | null) {
  return db()
    .updateTable('exportaciones_siagie')
    .set({ estado: 'generada', resultado_archivo_id: archivoId, observacion })
    .where('id', '=', id)
    .where('estado', '=', 'preparada')
    .returning('id')
    .executeTakeFirst();
}

export async function resolverExportacion(id: string, estado: 'aceptada' | 'rechazada', observacion: string | null) {
  return db()
    .updateTable('exportaciones_siagie')
    .set((eb) => ({ estado, observacion: observacion ?? eb.ref('observacion') }))
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}
