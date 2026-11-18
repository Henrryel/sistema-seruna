import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { DatosHora, EstadoHora, FilaHora, OpcionSesion } from '@/esquemas/planilla/horas';
import { iso, isoRequerido, patron } from './comun';

// Repositorio: ÚNICO lugar con SQL para horas docentes.

export interface FiltrosHoras {
  q?: string;
  estado?: EstadoHora;
  contratoId?: string;
  docenteId?: string;
  desde?: string;
  hasta?: string;
}

const NOMBRE_PERSONA = sql<string>`p.apellidos || ', ' || p.nombres`;

export async function listarHoras(filtros: FiltrosHoras, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('horas_docentes as h')
      .innerJoin('contratos_docentes as c', 'c.id', 'h.contrato_id')
      .innerJoin('docentes as d', 'd.id', 'c.docente_id')
      .innerJoin('personas as p', 'p.id', 'd.persona_id');
    if (filtros.estado) q = q.where('h.estado', '=', filtros.estado);
    if (filtros.contratoId) q = q.where('h.contrato_id', '=', filtros.contratoId);
    if (filtros.docenteId) q = q.where('c.docente_id', '=', filtros.docenteId);
    if (filtros.desde) q = q.where('h.fecha', '>=', filtros.desde);
    if (filtros.hasta) q = q.where('h.fecha', '<=', filtros.hasta);
    if (filtros.q) {
      const t = patron(filtros.q);
      q = q.where((eb) =>
        eb.or([
          eb('h.motivo', 'ilike', t),
          eb('c.referencia', 'ilike', t),
          eb('d.codigo', 'ilike', t),
          eb(NOMBRE_PERSONA, 'ilike', t),
        ]),
      );
    }
    return q;
  };
  const total = await base()
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('sesiones_clase as s', 's.id', 'h.sesion_id')
      .leftJoin('cursos_seccion as cs', 'cs.id', 's.curso_id')
      .leftJoin('asignaturas as asg', 'asg.id', 'cs.asignatura_id')
      .leftJoin('detalle_liquidacion_docente as dl', 'dl.hora_docente_id', 'h.id')
      .select([
        'h.id',
        'h.contrato_id',
        'c.referencia',
        'c.docente_id',
        NOMBRE_PERSONA.as('docente'),
        'h.fecha',
        'h.hora_inicio',
        'h.hora_fin',
        'h.minutos',
        'h.motivo',
        'h.sesion_id',
        sql<
          string | null
        >`case when s.id is null then null else coalesce(asg.nombre, 'Sesión') || ' ' || to_char(s.hora_inicio, 'HH24:MI') || '–' || to_char(s.hora_fin, 'HH24:MI') end`.as(
          'sesion',
        ),
        'h.evidencia_id',
        'h.estado',
        'h.decision',
        'h.registrado_en',
        'h.resuelto_en',
        'dl.liquidacion_id',
      ])
      .orderBy('h.fecha', filtros.estado === 'pendiente' ? 'asc' : 'desc')
      .orderBy('h.hora_inicio'),
    p,
  ).execute();
  return {
    filas: filas.map((f): FilaHora => ({
      id: f.id,
      contrato_id: f.contrato_id,
      referencia: f.referencia,
      docente_id: f.docente_id,
      docente: f.docente,
      fecha: f.fecha,
      hora_inicio: f.hora_inicio.slice(0, 5),
      hora_fin: f.hora_fin.slice(0, 5),
      minutos: Number(f.minutos ?? 0),
      motivo: f.motivo,
      sesion_id: f.sesion_id,
      sesion: f.sesion,
      evidencia_id: f.evidencia_id,
      estado: f.estado as EstadoHora,
      decision: f.decision,
      registrado_en: isoRequerido(f.registrado_en),
      resuelto_en: iso(f.resuelto_en),
      liquidacion_id: f.liquidacion_id ?? null,
    })),
    total: Number(total.n),
  };
}

export async function obtenerHora(id: string) {
  return db()
    .selectFrom('horas_docentes as h')
    .innerJoin('contratos_docentes as c', 'c.id', 'h.contrato_id')
    .select(['h.id', 'h.contrato_id', 'h.estado', 'h.fecha', 'c.docente_id'])
    .where('h.id', '=', id)
    .executeTakeFirst();
}

export async function crearHora(d: DatosHora & { evidenciaId: string | null; registradoPor: string }) {
  return db()
    .insertInto('horas_docentes')
    .values({
      contrato_id: d.contratoId,
      sesion_id: d.sesionId ?? null,
      fecha: d.fecha,
      hora_inicio: d.horaInicio,
      hora_fin: d.horaFin,
      motivo: d.motivo,
      evidencia_id: d.evidenciaId,
      registrado_por: d.registradoPor,
    })
    .returning(['id', 'minutos'])
    .executeTakeFirstOrThrow();
}

/** Resuelve (aprueba/rechaza) una hora. La base audita la resolución (`auditar_planilla`). */
export async function resolverHora(
  id: string,
  d: { estado: 'aprobada' | 'rechazada'; decision: string; resueltoPor: string },
) {
  return db()
    .updateTable('horas_docentes')
    .set({ estado: d.estado, decision: d.decision, resuelto_por: d.resueltoPor, resuelto_en: sql`now()` })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}

/** Sesiones de clase realizadas por el docente del contrato en la fecha (para vincular horas). */
export async function sesionesRealizadas(contratoId: string, fecha: string): Promise<OpcionSesion[]> {
  const filas = await db()
    .selectFrom('sesiones_clase as s')
    .innerJoin('contratos_docentes as c', 'c.docente_id', 's.docente_id')
    .innerJoin('cursos_seccion as cs', 'cs.id', 's.curso_id')
    .innerJoin('asignaturas as a', 'a.id', 'cs.asignatura_id')
    .innerJoin('secciones as sec', 'sec.id', 's.seccion_id')
    .innerJoin('grados as g', 'g.id', 'sec.grado_id')
    .select([
      's.id',
      's.hora_inicio',
      's.hora_fin',
      'a.nombre as asignatura',
      'sec.nombre as seccion',
      'g.numero as grado',
    ])
    .where('c.id', '=', contratoId)
    .where('s.fecha', '=', fecha)
    .where('s.estado', '=', 'realizada')
    .orderBy('s.hora_inicio')
    .execute();
  return filas.map((f) => ({
    valor: f.id,
    etiqueta: `${f.hora_inicio.slice(0, 5)}–${f.hora_fin.slice(0, 5)} · ${f.asignatura} · ${f.grado}.º ${f.seccion}`,
    extra: { horaInicio: f.hora_inicio.slice(0, 5), horaFin: f.hora_fin.slice(0, 5) },
  }));
}
