import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaDocumentoExpediente } from '@/esquemas/matricula/expedientes';
import { iso, patronLike } from './personas';

interface FiltrosExpediente {
  q?: string;
  estudianteId?: string;
  matriculaId?: string;
  tipoDocumentoId?: string;
  estado?: string;
}

export async function listarDocumentos(filtros: FiltrosExpediente, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('documentos_expediente as d')
      .innerJoin('estudiantes as e', 'e.id', 'd.estudiante_id')
      .innerJoin('personas as p', 'p.id', 'e.persona_id')
      .innerJoin('tipos_documento as t', 't.id', 'd.tipo_documento_id')
      .innerJoin('archivos as ar', 'ar.id', 'd.archivo_id')
      .leftJoin('matriculas as m', 'm.id', 'd.matricula_id')
      .leftJoin('anios_academicos as a', 'a.id', 'm.anio_id');
    if (filtros.estudianteId) q = q.where('d.estudiante_id', '=', filtros.estudianteId);
    if (filtros.matriculaId) q = q.where('d.matricula_id', '=', filtros.matriculaId);
    if (filtros.tipoDocumentoId) q = q.where('d.tipo_documento_id', '=', filtros.tipoDocumentoId);
    if (filtros.estado) q = q.where('d.estado', '=', filtros.estado);
    if (filtros.q) {
      const patron = patronLike(filtros.q);
      q = q.where((eb) =>
        eb.or([sql<boolean>`(p.apellidos || ' ' || p.nombres) ilike ${patron}`, eb('e.codigo', 'ilike', patron), eb('t.nombre', 'ilike', patron)]),
      );
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'd.id',
        'd.estudiante_id',
        'e.codigo',
        'p.nombres',
        'p.apellidos',
        'd.matricula_id',
        'a.anio',
        'd.tipo_documento_id',
        't.nombre as tipo_documento',
        'd.archivo_id',
        'ar.nombre_original as nombre_archivo',
        'd.estado',
        'd.cargado_en',
        'd.revisado_en',
        'd.observacion',
      ])
      .orderBy('d.cargado_en', 'desc')
      .orderBy('d.id', 'desc'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaDocumentoExpediente => ({ ...f, cargado_en: iso(f.cargado_en) as string, revisado_en: iso(f.revisado_en) }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerDocumento(id: string) {
  return db().selectFrom('documentos_expediente').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function crearDocumento(d: {
  estudianteId: string;
  matriculaId: string | null;
  tipoDocumentoId: string;
  archivoId: string;
  cargadoPor: string;
}) {
  return db()
    .insertInto('documentos_expediente')
    .values({
      estudiante_id: d.estudianteId,
      matricula_id: d.matriculaId,
      tipo_documento_id: d.tipoDocumentoId,
      archivo_id: d.archivoId,
      cargado_por: d.cargadoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function revisarDocumento(id: string, d: { estado: string; observacion: string | null; revisadoPor: string }) {
  return db()
    .updateTable('documentos_expediente')
    .set({ estado: d.estado, observacion: d.observacion, revisado_por: d.revisadoPor, revisado_en: sql`now()` })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function marcarReemplazado(id: string) {
  return db().updateTable('documentos_expediente').set({ estado: 'reemplazado' }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

/**
 * Requisitos de la regla de la matrícula frente a los documentos presentados por el estudiante
 * (de esa matrícula o sin matrícula), tomando el mejor documento no reemplazado de cada tipo.
 */
export async function requisitosConDocumentos(matriculaId: string) {
  return db()
    .selectFrom('matriculas as m')
    .innerJoin('requisitos_matricula as q', 'q.regla_id', 'm.regla_id')
    .innerJoin('tipos_documento as t', 't.id', 'q.tipo_documento_id')
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('documentos_expediente as d')
          .select(['d.id', 'd.estado', 'd.observacion'])
          .whereRef('d.estudiante_id', '=', 'm.estudiante_id')
          .whereRef('d.tipo_documento_id', '=', 'q.tipo_documento_id')
          .where('d.estado', '<>', 'reemplazado')
          .where((w) => w.or([w('d.matricula_id', 'is', null), w('d.matricula_id', '=', w.ref('m.id'))]))
          .orderBy(sql`case d.estado when 'validado' then 0 when 'pendiente' then 1 else 2 end`)
          .orderBy('d.cargado_en', 'desc')
          .limit(1)
          .as('doc'),
      (join) => join.onTrue(),
    )
    .select([
      'm.regla_id',
      'q.tipo_documento_id',
      't.codigo',
      't.nombre',
      'q.obligatorio',
      'q.admite_regularizacion',
      'q.plazo_regularizacion',
      'doc.id as documento_id',
      'doc.estado as estado_documento',
      'doc.observacion',
    ])
    .where('m.id', '=', matriculaId)
    .orderBy('q.obligatorio', 'desc')
    .orderBy('t.nombre')
    .execute();
}
