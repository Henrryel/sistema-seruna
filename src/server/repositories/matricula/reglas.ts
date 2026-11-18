import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { DatosRegla, DatosRequisito, DatosTipoDocumento, FilaRegla, FilaRequisito, FilaTipoDocumento } from '@/esquemas/matricula/reglas';
import { iso, patronLike } from './personas';

const GRADO = sql<string>`(select g.numero || '.º ' || n.nombre from grados g join niveles n on n.id = g.nivel_id where g.id = r.grado_id)`;

export async function listarReglas(
  filtros: { q?: string; anioId?: string; gradoId?: string; tipoIngreso?: string; publicada?: 'true' | 'false' },
  p: Paginacion | null,
) {
  const base = () => {
    let q = db().selectFrom('reglas_matricula as r').innerJoin('anios_academicos as a', 'a.id', 'r.anio_id');
    if (filtros.anioId) q = q.where('r.anio_id', '=', filtros.anioId);
    if (filtros.gradoId) q = q.where('r.grado_id', '=', filtros.gradoId);
    if (filtros.tipoIngreso) q = q.where('r.tipo_ingreso', '=', filtros.tipoIngreso);
    if (filtros.publicada) q = q.where('r.publicada_en', filtros.publicada === 'true' ? 'is not' : 'is', null);
    if (filtros.q) q = q.where('r.referencia_normativa', 'ilike', patronLike(filtros.q));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        'r.id',
        'r.anio_id',
        'a.anio',
        'r.grado_id',
        GRADO.as('grado'),
        'r.tipo_ingreso',
        'r.version',
        'r.solicitudes_inicio',
        'r.solicitudes_fin',
        'r.corte_edad',
        'r.edad_minima',
        'r.edad_maxima',
        'r.referencia_normativa',
        'r.publicada_en',
        eb.selectFrom('requisitos_matricula as q').select((e) => e.fn.countAll<string>().as('n')).whereRef('q.regla_id', '=', 'r.id').as('requisitos'),
        eb.selectFrom('matriculas as m').select((e) => e.fn.countAll<string>().as('n')).whereRef('m.regla_id', '=', 'r.id').as('matriculas'),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy(sql`(select g.nivel_id from grados g where g.id = r.grado_id)`)
      .orderBy(sql`(select g.numero from grados g where g.id = r.grado_id)`)
      .orderBy('r.tipo_ingreso')
      .orderBy('r.version', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaRegla => ({ ...f, publicada_en: iso(f.publicada_en), requisitos: Number(f.requisitos ?? 0), matriculas: Number(f.matriculas ?? 0) }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerRegla(id: string) {
  return db().selectFrom('reglas_matricula').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function siguienteVersion(anioId: string, gradoId: string, tipoIngreso: string) {
  const f = await db()
    .selectFrom('reglas_matricula')
    .select(sql<number>`coalesce(max(version), 0) + 1`.as('v'))
    .where('anio_id', '=', anioId)
    .where('grado_id', '=', gradoId)
    .where('tipo_ingreso', '=', tipoIngreso)
    .executeTakeFirstOrThrow();
  return Number(f.v);
}

const valoresRegla = (d: DatosRegla) => ({
  anio_id: d.anioId,
  grado_id: d.gradoId,
  tipo_ingreso: d.tipoIngreso,
  solicitudes_inicio: d.solicitudesInicio,
  solicitudes_fin: d.solicitudesFin,
  corte_edad: d.corteEdad ?? null,
  edad_minima: d.edadMinima,
  edad_maxima: d.edadMaxima,
  referencia_normativa: d.referenciaNormativa,
});

export async function crearRegla(d: DatosRegla, version: number) {
  return db()
    .insertInto('reglas_matricula')
    .values({ ...valoresRegla(d), version })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow();
}

export async function actualizarRegla(id: string, d: DatosRegla) {
  return db().updateTable('reglas_matricula').set(valoresRegla(d)).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function publicarRegla(id: string) {
  return db()
    .updateTable('reglas_matricula')
    .set({ publicada_en: sql`now()` })
    .where('id', '=', id)
    .where('publicada_en', 'is', null)
    .returning(['id'])
    .executeTakeFirst();
}

export async function eliminarRegla(id: string) {
  await db().deleteFrom('requisitos_matricula').where('regla_id', '=', id).execute();
  return db().deleteFrom('reglas_matricula').where('id', '=', id).returning(['id']).executeTakeFirst();
}

/** Regla publicada (publicada_en ≤ ahora) de mayor versión para año, grado y tipo de ingreso. */
export async function reglaVigente(anioId: string, gradoId: string, tipoIngreso: string) {
  return db()
    .selectFrom('reglas_matricula')
    .selectAll()
    .where('anio_id', '=', anioId)
    .where('grado_id', '=', gradoId)
    .where('tipo_ingreso', '=', tipoIngreso)
    .where('publicada_en', 'is not', null)
    .where('publicada_en', '<=', sql<Date>`now()`)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst();
}

export async function listarRequisitos(reglaId: string): Promise<FilaRequisito[]> {
  return db()
    .selectFrom('requisitos_matricula as q')
    .innerJoin('tipos_documento as t', 't.id', 'q.tipo_documento_id')
    .select(['q.regla_id', 'q.tipo_documento_id', 't.codigo', 't.nombre', 'q.obligatorio', 'q.admite_regularizacion', 'q.plazo_regularizacion'])
    .where('q.regla_id', '=', reglaId)
    .orderBy('q.obligatorio', 'desc')
    .orderBy('t.nombre')
    .execute();
}

export async function guardarRequisito(reglaId: string, d: DatosRequisito) {
  const valores = {
    obligatorio: d.obligatorio,
    admite_regularizacion: d.admiteRegularizacion,
    plazo_regularizacion: d.plazoRegularizacion ?? null,
  };
  return db()
    .insertInto('requisitos_matricula')
    .values({ regla_id: reglaId, tipo_documento_id: d.tipoDocumentoId, ...valores })
    .onConflict((oc) => oc.columns(['regla_id', 'tipo_documento_id']).doUpdateSet(valores))
    .returning(['regla_id', 'tipo_documento_id'])
    .executeTakeFirstOrThrow();
}

export async function eliminarRequisito(reglaId: string, tipoDocumentoId: string) {
  return db()
    .deleteFrom('requisitos_matricula')
    .where('regla_id', '=', reglaId)
    .where('tipo_documento_id', '=', tipoDocumentoId)
    .returning(['regla_id'])
    .executeTakeFirst();
}

export async function copiarRequisitos(origenId: string, destinoId: string) {
  await db()
    .insertInto('requisitos_matricula')
    .columns(['regla_id', 'tipo_documento_id', 'obligatorio', 'admite_regularizacion', 'plazo_regularizacion'])
    .expression((eb) =>
      eb
        .selectFrom('requisitos_matricula')
        .select([sql<string>`${destinoId}::bigint`.as('regla_id'), 'tipo_documento_id', 'obligatorio', 'admite_regularizacion', 'plazo_regularizacion'])
        .where('regla_id', '=', origenId),
    )
    .execute();
}

// Tipos de documento del expediente.

export async function listarTiposDocumento(filtros: { q?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('tipos_documento as t');
    if (filtros.q) q = q.where((eb) => eb.or([eb('t.codigo', 'ilike', patronLike(filtros.q ?? '')), eb('t.nombre', 'ilike', patronLike(filtros.q ?? ''))]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        't.id',
        't.codigo',
        't.nombre',
        sql<string>`(select count(*) from requisitos_matricula q where q.tipo_documento_id = t.id) + (select count(*) from documentos_expediente d where d.tipo_documento_id = t.id)`.as(
          'usos',
        ),
      ])
      .orderBy('t.nombre'),
    p,
  ).execute();
  return { filas: filas.map((f): FilaTipoDocumento => ({ ...f, usos: Number(f.usos) })), total: Number(total.n) };
}

export async function crearTipoDocumento(d: DatosTipoDocumento) {
  return db().insertInto('tipos_documento').values({ codigo: d.codigo, nombre: d.nombre }).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarTipoDocumento(id: string, d: DatosTipoDocumento) {
  return db().updateTable('tipos_documento').set({ codigo: d.codigo, nombre: d.nombre }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarTipoDocumento(id: string) {
  return db().deleteFrom('tipos_documento').where('id', '=', id).returning(['id']).executeTakeFirst();
}
