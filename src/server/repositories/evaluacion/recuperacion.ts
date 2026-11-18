import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { DatosRecuperacion, EvaluacionRecuperacionFila, FilaPendienteRecuperacion } from '@/esquemas/evaluacion/recuperacion';

// Evaluaciones de recuperación/subsanación. `controlar_evaluacion_recuperacion` exige competencia pendiente en un
// cierre aprobado, fecha ≥ corte, nacimiento en borrador, aprobación sin cambios y conservación del historial.

function base() {
  return db()
    .selectFrom('resultados_anuales_competencia as r')
    .innerJoin('cierres_anuales as ca', 'ca.id', 'r.cierre_anual_id')
    .innerJoin('matriculas as m', 'm.id', 'ca.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .innerJoin('secciones as s', 's.id', 'ca.seccion_id')
    .innerJoin('grados as g', 'g.id', 'ca.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('competencias as k', 'k.id', 'r.competencia_id')
    .leftJoin('areas_curriculares as ar', 'ar.id', 'k.area_id')
    .where('r.requiere_recuperacion', '=', true)
    .where('ca.estado', '=', 'aprobado');
}

const ESTADO_EVAL = {
  sin_evaluacion: sql<boolean>`not exists (select 1 from evaluaciones_recuperacion x where x.resultado_origen_id = r.id)`,
  borrador: sql<boolean>`exists (select 1 from evaluaciones_recuperacion x where x.resultado_origen_id = r.id and x.estado = 'borrador')`,
  aprobada: sql<boolean>`exists (select 1 from evaluaciones_recuperacion x where x.resultado_origen_id = r.id and x.estado = 'aprobada')`,
} as const;

export async function listarPendientes(
  filtros: { anioId?: string; seccionId?: string; estado?: keyof typeof ESTADO_EVAL; q?: string },
  p: Paginacion | null,
) {
  const filtrar = (q: ReturnType<typeof base>) => {
    let r = q;
    if (filtros.anioId) r = r.where('ca.anio_id', '=', filtros.anioId);
    if (filtros.seccionId) r = r.where('ca.seccion_id', '=', filtros.seccionId);
    if (filtros.estado) r = r.where(ESTADO_EVAL[filtros.estado]);
    if (filtros.q) {
      const t = `%${filtros.q}%`;
      r = r.where((eb) => eb.or([eb('p.apellidos', 'ilike', t), eb('p.nombres', 'ilike', t), eb('e.codigo', 'ilike', t), eb('k.nombre', 'ilike', t)]));
    }
    return r;
  };
  const total = await filtrar(base()).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    filtrar(base())
      .select([
        'r.id as resultado_id',
        'ca.id as cierre_anual_id',
        'ca.version as cierre_version',
        'ca.matricula_id',
        'e.codigo',
        sql<string>`p.apellidos || ', ' || p.nombres`.as('alumno'),
        's.nombre as seccion',
        'g.numero as grado',
        'n.nombre as nivel',
        sql<string>`k.codigo || ' · ' || k.nombre`.as('competencia'),
        'ar.nombre as area',
        'r.nivel_logro as nivel_original',
        'ca.fecha_corte',
        sql<EvaluacionRecuperacionFila[]>`coalesce((
          select json_agg(json_build_object(
            'id', x.id::text, 'intento', x.intento, 'tipo', x.tipo, 'fecha', x.fecha, 'nivel_logro', x.nivel_logro,
            'conclusion', x.conclusion, 'estado', x.estado, 'aprobado_en', x.aprobado_en) order by x.intento)
          from evaluaciones_recuperacion x where x.resultado_origen_id = r.id), '[]'::json)`.as('evaluaciones'),
      ])
      .orderBy('g.nivel_id')
      .orderBy('g.numero')
      .orderBy('s.nombre')
      .orderBy('p.apellidos')
      .orderBy('k.codigo'),
    p,
  ).execute();
  return { filas: filas as FilaPendienteRecuperacion[], total: Number(total.n) };
}

export async function crearEvaluacion(d: DatosRecuperacion & { registradoPor: string }) {
  return db()
    .insertInto('evaluaciones_recuperacion')
    .values({
      resultado_origen_id: d.resultadoOrigenId,
      intento: sql<number>`(select coalesce(max(intento), 0) + 1 from evaluaciones_recuperacion where resultado_origen_id = ${d.resultadoOrigenId})`,
      tipo: d.tipo,
      fecha: d.fecha,
      nivel_logro: d.nivelLogro,
      conclusion: d.conclusion,
      registrado_por: d.registradoPor,
      estado: 'borrador',
    })
    .returning(['id', 'intento'])
    .executeTakeFirstOrThrow();
}

export async function editarEvaluacion(id: string, d: Omit<DatosRecuperacion, 'resultadoOrigenId'>) {
  return db()
    .updateTable('evaluaciones_recuperacion')
    .set({ tipo: d.tipo, fecha: d.fecha, nivel_logro: d.nivelLogro, conclusion: d.conclusion })
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst();
}

export async function aprobarEvaluacion(id: string, usuarioId: string) {
  return db()
    .updateTable('evaluaciones_recuperacion')
    .set({ estado: 'aprobada', aprobado_por: usuarioId, aprobado_en: sql<Date>`clock_timestamp()` })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}
