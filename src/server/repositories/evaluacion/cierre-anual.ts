import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaCierreAnual } from '@/esquemas/evaluacion/cierre-anual';

// Cierres anuales por matrícula y sus resultados por competencia. `controlar_cierre_anual` y
// `controlar_resultado_anual` imponen la trayectoria de versiones, la fecha de corte, la coherencia con los
// últimos logros publicados y la inmutabilidad del cierre aprobado.

function base() {
  return db()
    .with('ultimos', (qb) =>
      qb.selectFrom('cierres_anuales').selectAll().distinctOn('matricula_id').orderBy('matricula_id').orderBy('version', 'desc'),
    )
    .selectFrom('ultimos as ca')
    .innerJoin('matriculas as m', 'm.id', 'ca.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .innerJoin('secciones as s', 's.id', 'ca.seccion_id')
    .innerJoin('grados as g', 'g.id', 'ca.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id');
}

export async function listarCierresAnuales(
  filtros: { anioId?: string; seccionId?: string; estado?: string; situacion?: string; q?: string },
  p: Paginacion | null,
) {
  const filtrar = (q: ReturnType<typeof base>) => {
    let r = q;
    if (filtros.anioId) r = r.where('ca.anio_id', '=', filtros.anioId);
    if (filtros.seccionId) r = r.where('ca.seccion_id', '=', filtros.seccionId);
    if (filtros.estado) r = r.where('ca.estado', '=', filtros.estado);
    if (filtros.situacion) r = r.where('ca.situacion', '=', filtros.situacion);
    if (filtros.q) {
      const t = `%${filtros.q}%`;
      r = r.where((eb) => eb.or([eb('p.apellidos', 'ilike', t), eb('p.nombres', 'ilike', t), eb('e.codigo', 'ilike', t)]));
    }
    return r;
  };
  const total = await filtrar(base()).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    filtrar(base())
      .select([
        'ca.id',
        'ca.matricula_id',
        'e.id as estudiante_id',
        'e.codigo',
        sql<string>`p.apellidos || ', ' || p.nombres`.as('alumno'),
        's.nombre as seccion',
        'g.numero as grado',
        'n.nombre as nivel',
        'ca.version',
        'ca.etapa',
        'ca.estado',
        'ca.situacion',
        'ca.fecha_corte',
        'ca.aprobado_en',
        sql<string>`(select count(*) from resultados_anuales_competencia r where r.cierre_anual_id = ca.id)`.as('resultados'),
        sql<string>`(select count(*) from resultados_anuales_competencia r where r.cierre_anual_id = ca.id and r.requiere_recuperacion)`.as('pendientes'),
        sql<string>`(select count(*) from cierres_anuales x where x.matricula_id = ca.matricula_id)`.as('versiones'),
      ])
      .orderBy('g.nivel_id')
      .orderBy('g.numero')
      .orderBy('s.nombre')
      .orderBy('p.apellidos')
      .orderBy('p.nombres'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaCierreAnual => ({
        ...f,
        etapa: f.etapa as FilaCierreAnual['etapa'],
        estado: f.estado as FilaCierreAnual['estado'],
        situacion: f.situacion as FilaCierreAnual['situacion'],
        aprobado_en: f.aprobado_en ? f.aprobado_en.toISOString() : null,
        resultados: Number(f.resultados ?? 0),
        pendientes: Number(f.pendientes ?? 0),
        versiones: Number(f.versiones ?? 0),
      }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerCierreAnual(id: string) {
  return db()
    .selectFrom('cierres_anuales as ca')
    .innerJoin('matriculas as m', 'm.id', 'ca.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .innerJoin('secciones as s', 's.id', 'ca.seccion_id')
    .innerJoin('grados as g', 'g.id', 'ca.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('reglas_evaluacion as r', 'r.id', 'ca.regla_id')
    .select([
      'ca.id',
      'ca.matricula_id',
      'ca.anio_id',
      'ca.grado_id',
      'ca.seccion_id',
      'ca.plan_id',
      'ca.regla_id',
      'ca.version',
      'ca.etapa',
      'ca.anterior_id',
      'ca.fecha_corte',
      'ca.estado',
      'ca.situacion',
      'ca.sustento',
      'ca.motivo_revision',
      'ca.aprobado_en',
      'e.id as estudiante_id',
      'e.codigo',
      sql<string>`p.apellidos || ', ' || p.nombres`.as('alumno'),
      's.nombre as seccion',
      'g.numero as grado',
      'n.nombre as nivel',
      'r.version as regla_version',
      'r.referencia_normativa',
      'r.criterios',
      sql<string>`(select count(*) from cierres_anuales x where x.matricula_id = ca.matricula_id)`.as('versiones'),
      sql<boolean>`(ca.version = (select max(x.version) from cierres_anuales x where x.matricula_id = ca.matricula_id))`.as('es_ultimo'),
    ])
    .where('ca.id', '=', id)
    .executeTakeFirst();
}

/** Matrículas ubicadas en la sección al corte, no anuladas y sin cierre anual registrado. */
export async function candidatosCierre(anioId: string, fechaCorte: string, seccionId?: string) {
  let q = db()
    .selectFrom('matricula_secciones as ms')
    .innerJoin('matriculas as m', 'm.id', 'ms.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select(['m.id as matricula_id', 'ms.seccion_id', 'm.grado_id', 'm.anio_id', sql<string>`p.apellidos || ', ' || p.nombres`.as('alumno')])
    .where('m.anio_id', '=', anioId)
    .where('m.estado', '<>', 'anulada')
    .where(sql<boolean>`ms.vigencia @> ${fechaCorte}::date`)
    .where(({ not, exists, selectFrom }) => not(exists(selectFrom('cierres_anuales as x').select('x.id').whereRef('x.matricula_id', '=', 'm.id'))))
    .orderBy('ms.seccion_id')
    .orderBy('p.apellidos');
  if (seccionId) q = q.where('ms.seccion_id', '=', seccionId);
  return q.execute();
}

export async function insertarCierreAnual(d: {
  matriculaId: string;
  anioId: string;
  gradoId: string;
  seccionId: string;
  planId: string;
  reglaId: string;
  version: number;
  etapa: 'ordinario' | 'rectificacion' | 'recuperacion';
  anteriorId: string | null;
  fechaCorte: string;
  motivoRevision: string | null;
  registradoPor: string;
}) {
  return db()
    .insertInto('cierres_anuales')
    .values({
      matricula_id: d.matriculaId,
      anio_id: d.anioId,
      grado_id: d.gradoId,
      seccion_id: d.seccionId,
      plan_id: d.planId,
      regla_id: d.reglaId,
      version: d.version,
      etapa: d.etapa,
      anterior_id: d.anteriorId,
      fecha_corte: d.fechaCorte,
      estado: 'borrador',
      motivo_revision: d.motivoRevision,
      registrado_por: d.registradoPor,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
}

export async function ultimosLogros(matriculaId: string) {
  return db()
    .selectFrom('ultimos_logros_publicados')
    .select(['competencia_id', 'calificacion_id', 'bimestre', 'nivel_logro', 'conclusion'])
    .where('matricula_id', '=', matriculaId)
    .execute();
}

export async function resultadosDe(cierreId: string) {
  return db()
    .selectFrom('resultados_anuales_competencia as r')
    .innerJoin('competencias as k', 'k.id', 'r.competencia_id')
    .leftJoin('areas_curriculares as ar', 'ar.id', 'k.area_id')
    .leftJoin('calificaciones_competencia as c', 'c.id', 'r.calificacion_id')
    .leftJoin('bimestres as b', 'b.id', 'c.bimestre_id')
    .select([
      'r.id',
      'r.competencia_id',
      'k.nombre as competencia',
      'k.codigo',
      'ar.nombre as area',
      'ar.codigo as area_codigo',
      'r.nivel_logro',
      'r.conclusion',
      'r.requiere_recuperacion',
      'r.calificacion_id',
      'r.resultado_anterior_id',
      'r.recuperacion_id',
      'b.numero as bimestre',
    ])
    .where('r.cierre_anual_id', '=', cierreId)
    .orderBy('ar.nombre')
    .orderBy('k.codigo')
    .execute();
}

/** Inserta un resultado; el trigger copia nivel y conclusión desde la fuente (se envían por la restricción NOT NULL). */
export async function insertarResultado(d: {
  cierreId: string;
  planId: string;
  competenciaId: string;
  nivel: string;
  conclusion: string | null;
  requiereRecuperacion: boolean;
  calificacionId?: string | null;
  resultadoAnteriorId?: string | null;
  recuperacionId?: string | null;
}) {
  return db()
    .insertInto('resultados_anuales_competencia')
    .values({
      cierre_anual_id: d.cierreId,
      plan_id: d.planId,
      competencia_id: d.competenciaId,
      nivel_logro: d.nivel,
      conclusion: d.conclusion,
      requiere_recuperacion: d.requiereRecuperacion,
      calificacion_id: d.calificacionId ?? null,
      resultado_anterior_id: d.resultadoAnteriorId ?? null,
      recuperacion_id: d.recuperacionId ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
}

export async function borrarResultados(cierreId: string) {
  await db().deleteFrom('resultados_anuales_competencia').where('cierre_anual_id', '=', cierreId).execute();
}

export async function fijarSituacion(cierreId: string, situacion: string | null) {
  await db().updateTable('cierres_anuales').set({ situacion }).where('id', '=', cierreId).execute();
}

export async function aprobarCierreAnual(id: string, usuarioId: string, situacion: string, sustento: string) {
  return db()
    .updateTable('cierres_anuales')
    .set({ estado: 'aprobado', situacion, sustento, aprobado_por: usuarioId, aprobado_en: sql<Date>`clock_timestamp()` })
    .where('id', '=', id)
    .returning(['id', 'situacion'])
    .executeTakeFirst();
}

export async function eliminarCierreAnual(id: string) {
  return db().deleteFrom('cierres_anuales').where('id', '=', id).returning('id').executeTakeFirst();
}

export async function trayectoria(matriculaId: string) {
  return db()
    .selectFrom('cierres_anuales')
    .select(['id', 'version', 'etapa', 'estado', 'situacion', 'aprobado_en'])
    .where('matricula_id', '=', matriculaId)
    .orderBy('version')
    .execute();
}

/** Última evaluación de recuperación APROBADA por resultado pendiente del cierre indicado. */
export async function recuperacionesAprobadas(cierreId: string) {
  return db()
    .selectFrom('evaluaciones_recuperacion as e')
    .innerJoin('resultados_anuales_competencia as r', 'r.id', 'e.resultado_origen_id')
    .select(['e.id', 'e.resultado_origen_id', 'r.competencia_id', 'e.nivel_logro', 'e.conclusion'])
    .distinctOn('e.resultado_origen_id')
    .where('r.cierre_anual_id', '=', cierreId)
    .where('e.estado', '=', 'aprobada')
    .orderBy('e.resultado_origen_id')
    .orderBy('e.intento', 'desc')
    .execute();
}
