import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaLibreta } from '@/esquemas/evaluacion/notas';

// Lectura de logros PUBLICADOS (vista reporte_notas_publicadas) y situación final vigente (situaciones_finales).

const SECCION_ACTUAL = sql<string | null>`(
  select s.nombre from matricula_secciones ms join secciones s on s.id = ms.seccion_id
  where ms.matricula_id = m.id order by upper(ms.vigencia) desc nulls first limit 1)`;

export async function matriculasDeEstudiante(estudianteId: string) {
  return db()
    .selectFrom('matriculas as m')
    .innerJoin('anios_academicos as a', 'a.id', 'm.anio_id')
    .innerJoin('grados as g', 'g.id', 'm.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select(['m.id', 'a.anio', 'g.numero as grado', 'n.nombre as nivel', SECCION_ACTUAL.as('seccion')])
    .where('m.estudiante_id', '=', estudianteId)
    .where('m.estado', '<>', 'anulada')
    .orderBy('a.anio', 'desc')
    .execute();
}

export async function datosMatricula(matriculaId: string) {
  return db()
    .selectFrom('matriculas as m')
    .innerJoin('anios_academicos as a', 'a.id', 'm.anio_id')
    .innerJoin('grados as g', 'g.id', 'm.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select([
      'm.id',
      'm.estado',
      'a.anio',
      'g.numero as grado',
      'n.nombre as nivel',
      SECCION_ACTUAL.as('seccion'),
      'e.id as estudiante_id',
      'e.codigo',
      'e.codigo_siagie',
      'p.nombres',
      'p.apellidos',
    ])
    .where('m.id', '=', matriculaId)
    .executeTakeFirst();
}

export async function notasPublicadas(matriculaId: string) {
  return db()
    .selectFrom('reporte_notas_publicadas as v')
    .innerJoin('competencias as k', 'k.id', 'v.competencia_id')
    .select(['v.bimestre', 'v.competencia_id', 'k.codigo', 'v.competencia', 'v.area', 'v.estado', 'v.nivel_logro', 'v.conclusion', 'v.publicado_en'])
    .where('v.matricula_id', '=', matriculaId)
    .orderBy('v.area')
    .orderBy('k.codigo')
    .orderBy('v.bimestre')
    .execute();
}

export async function situacionFinal(matriculaId: string) {
  return db()
    .selectFrom('situaciones_finales')
    .select(['cierre_anual_id', 'situacion', 'etapa', 'version', 'aprobado_en'])
    .where('matricula_id', '=', matriculaId)
    .executeTakeFirst();
}

export async function resultadosAnuales(cierreAnualId: string) {
  return db()
    .selectFrom('resultados_anuales_competencia')
    .select(['competencia_id', 'nivel_logro', 'conclusion', 'requiere_recuperacion'])
    .where('cierre_anual_id', '=', cierreAnualId)
    .execute();
}

function baseLibretas(seccionId?: string, anioId?: string) {
  let q = db()
    .selectFrom('matriculas as m')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .where('m.estado', '<>', 'anulada');
  if (anioId) q = q.where('m.anio_id', '=', anioId);
  if (seccionId) {
    q = q.where(({ exists, selectFrom }) =>
      exists(selectFrom('matricula_secciones as ms').select('ms.id').whereRef('ms.matricula_id', '=', 'm.id').where('ms.seccion_id', '=', seccionId)),
    );
  }
  return q;
}

export async function listarLibretas(filtros: { anioId?: string; seccionId?: string; q?: string }, p: Paginacion | null) {
  const filtrar = (q: ReturnType<typeof baseLibretas>) => {
    if (!filtros.q) return q;
    const t = `%${filtros.q}%`;
    return q.where((eb) => eb.or([eb('p.apellidos', 'ilike', t), eb('p.nombres', 'ilike', t), eb('e.codigo', 'ilike', t)]));
  };
  const total = await filtrar(baseLibretas(filtros.seccionId, filtros.anioId)).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    filtrar(baseLibretas(filtros.seccionId, filtros.anioId))
      .select([
        'm.id as matricula_id',
        'e.id as estudiante_id',
        'e.codigo',
        sql<string>`p.apellidos || ', ' || p.nombres`.as('alumno'),
        SECCION_ACTUAL.as('seccion'),
        'm.estado',
        sql<string>`(select count(distinct v.bimestre_id) from reporte_notas_publicadas v where v.matricula_id = m.id)`.as('bimestres_publicados'),
        sql<string | null>`(select f.situacion from situaciones_finales f where f.matricula_id = m.id)`.as('situacion'),
      ])
      .orderBy('p.apellidos')
      .orderBy('p.nombres'),
    p,
  ).execute();
  return { filas: filas.map((f): FilaLibreta => ({ ...f, bimestres_publicados: Number(f.bimestres_publicados ?? 0) })), total: Number(total.n) };
}

/** Matrículas (no anuladas) que pasaron por la sección, para la libreta masiva. */
export async function matriculasDeSeccion(seccionId: string) {
  const filas = await baseLibretas(seccionId).select('m.id').orderBy('p.apellidos').orderBy('p.nombres').execute();
  return filas.map((f) => f.id);
}
