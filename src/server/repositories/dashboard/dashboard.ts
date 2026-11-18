import 'server-only';
import { db, sql } from '@/server/db';
import type {
  ClaseDelDia,
  DistribucionNivel,
  IndicadoresDashboard,
  LogroReciente,
  MatriculaInicio,
  PendienteCalificacion,
  PlanillaMes,
  RecaudacionDia,
  ResumenAsistencia,
  ResumenDeuda,
} from '@/esquemas/dashboard/dashboard';

// Repositorio del panel institucional y de las páginas de inicio: ÚNICO lugar con SQL de este módulo.
// Los indicadores los calcula `indicadores_dashboard`; aquí solo hay desgloses complementarios.

const LIMA = sql.raw(`'America/Lima'`);

/** Instante de inicio del día `fecha` en Lima (para comparar timestamptz igual que la base). */
const inicioDia = (fecha: string) => sql`(${fecha}::date)::timestamp at time zone ${LIMA}`;
const finDia = (fecha: string) => sql`(${fecha}::date + 1)::timestamp at time zone ${LIMA}`;

export async function indicadores(anioId: string, desde: string, hasta: string, bimestreId?: string | null): Promise<IndicadoresDashboard> {
  const r = await sql<{ indicadores: IndicadoresDashboard }>`
    select indicadores_dashboard(${anioId}::bigint, ${desde}::date, ${hasta}::date, ${bimestreId ?? null}::bigint) as indicadores
  `.execute(db());
  const fila = r.rows[0];
  if (!fila) throw new Error('indicadores_dashboard no devolvió resultado');
  return fila.indicadores;
}

/** Distribución AD/A/B/C de las calificaciones publicadas del bimestre (vista reporte_notas_publicadas). */
export async function distribucionNiveles(anioId: string, bimestreId: string, hasta: string): Promise<DistribucionNivel[]> {
  const filas = await db()
    .selectFrom('reporte_notas_publicadas as r')
    .select((eb) => ['r.nivel_logro', eb.fn.countAll<string>().as('n')])
    .where('r.anio_id', '=', anioId)
    .where('r.bimestre_id', '=', bimestreId)
    .where('r.estado', '=', 'evaluada')
    .where(sql<boolean>`r.publicado_en < ${finDia(hasta)}`)
    .groupBy('r.nivel_logro')
    .execute();
  const mapa = new Map(filas.map((f) => [f.nivel_logro, Number(f.n)]));
  return (['AD', 'A', 'B', 'C'] as const).map((nivel) => ({ nivel, cantidad: mapa.get(nivel) ?? 0 }));
}

/** Importe aplicado a cuotas del año, por día de pago (Lima). */
export async function recaudacionPorDia(anioId: string, desde: string, hasta: string): Promise<RecaudacionDia[]> {
  const r = await sql<{ fecha: string; cobrado: string; pagos: string }>`
    select (p.pagado_en at time zone ${LIMA})::date as fecha,
           sum(a.importe)::text as cobrado,
           count(distinct p.id) as pagos
    from aplicaciones_pago a
    join cuotas q on q.id = a.cuota_id
    join pagos p on p.id = a.pago_id
    where q.anio_id = ${anioId}::bigint
      and p.pagado_en >= ${inicioDia(desde)} and p.pagado_en < ${finDia(hasta)}
    group by 1
    order by 1
  `.execute(db());
  return r.rows.map((f) => ({ fecha: String(f.fecha), cobrado: f.cobrado, pagos: Number(f.pagos) }));
}

/** Liquidaciones docentes de los períodos (meses) que caen en el rango, con totales y saldos. */
export async function resumenPlanilla(desde: string, hasta: string) {
  const filtro = sql`pl.mes >= date_trunc('month', ${desde}::date)::date and pl.mes <= ${hasta}::date`;
  const totales = await sql<{ liquidaciones: string; borradores: string; aprobadas: string; neto: string; abonado: string; saldo: string }>`
    select count(*) as liquidaciones,
           count(*) filter (where l.estado = 'borrador') as borradores,
           count(*) filter (where l.estado = 'aprobada') as aprobadas,
           coalesce(sum(s.neto), 0)::text as neto,
           coalesce(sum(s.abonado), 0)::text as abonado,
           coalesce(sum(s.saldo), 0)::text as saldo
    from liquidaciones_docentes l
    join periodos_liquidacion pl on pl.id = l.periodo_id
    join saldos_liquidacion_docente s on s.liquidacion_id = l.id
    where ${filtro}
  `.execute(db());
  const porMes = await sql<PlanillaMes>`
    select pl.mes::text as mes, coalesce(sum(s.neto), 0)::text as neto, coalesce(sum(s.abonado), 0)::text as abonado
    from liquidaciones_docentes l
    join periodos_liquidacion pl on pl.id = l.periodo_id
    join saldos_liquidacion_docente s on s.liquidacion_id = l.id
    where ${filtro}
    group by pl.mes
    order by pl.mes
  `.execute(db());
  const t = totales.rows[0];
  return {
    liquidaciones: Number(t?.liquidaciones ?? 0),
    borradores: Number(t?.borradores ?? 0),
    aprobadas: Number(t?.aprobadas ?? 0),
    neto: t?.neto ?? '0',
    abonado: t?.abonado ?? '0',
    saldo: t?.saldo ?? '0',
    porMes: porMes.rows,
  };
}

// ---------------------------------------------------------------- Portal docente

const columnasClase = (origen: 'sesion' | 'horario') => sql.raw(`'${origen}'`);

/** Sesiones de clase fechadas del docente en el día. */
export async function sesionesDelDia(docenteId: string, fecha: string): Promise<ClaseDelDia[]> {
  const r = await sql<ClaseDelDia>`
    select sc.id, ${columnasClase('sesion')} as origen, sc.curso_id, a.nombre as asignatura, s.nombre as seccion,
           g.numero as grado, n.nombre as nivel, au.nombre as aula,
           to_char(sc.hora_inicio, 'HH24:MI') as hora_inicio, to_char(sc.hora_fin, 'HH24:MI') as hora_fin, sc.estado
    from sesiones_clase sc
    join cursos_seccion c on c.id = sc.curso_id
    join asignaturas a on a.id = c.asignatura_id
    join secciones s on s.id = sc.seccion_id
    join grados g on g.id = s.grado_id
    join niveles n on n.id = g.nivel_id
    left join aulas au on au.id = sc.aula_id
    where sc.docente_id = ${docenteId}::bigint and sc.fecha = ${fecha}::date
    order by sc.hora_inicio, s.nombre
  `.execute(db());
  return r.rows;
}

/** Bloques del horario semanal vigentes ese día (cuando aún no hay sesiones fechadas). */
export async function bloquesDelDia(docenteId: string, fecha: string): Promise<ClaseDelDia[]> {
  const r = await sql<ClaseDelDia>`
    select h.id, ${columnasClase('horario')} as origen, h.curso_id, a.nombre as asignatura, s.nombre as seccion,
           g.numero as grado, n.nombre as nivel, au.nombre as aula,
           to_char(h.hora_inicio, 'HH24:MI') as hora_inicio, to_char(h.hora_fin, 'HH24:MI') as hora_fin, null::text as estado
    from bloques_horario h
    join cursos_seccion c on c.id = h.curso_id
    join asignaturas a on a.id = c.asignatura_id
    join secciones s on s.id = h.seccion_id
    join grados g on g.id = s.grado_id
    join niveles n on n.id = g.nivel_id
    left join aulas au on au.id = h.aula_id
    where h.docente_id = ${docenteId}::bigint
      and h.dia_iso = extract(isodow from ${fecha}::date)
      and h.vigencia @> ${fecha}::date
    order by h.hora_inicio, s.nombre
  `.execute(db());
  return r.rows;
}

/**
 * Cierres en borrador de las secciones del docente con competencias de sus cursos aún sin resolver
 * (sin calificación o en estado 'pendiente'), por curso.
 */
export async function calificacionesPendientes(docenteId: string): Promise<PendienteCalificacion[]> {
  const r = await sql<PendienteCalificacion & { esperadas: string; pendientes: string }>`
    select x.id as cierre_id, b.numero as bimestre, c.id as curso_id, a.nombre as asignatura, s.nombre as seccion,
           g.numero as grado, n.nombre as nivel,
           count(*) as esperadas,
           count(*) filter (where cc.estado is null or cc.estado = 'pendiente') as pendientes
    from cierres_evaluacion x
    join bimestres b on b.id = x.bimestre_id
    join cursos_seccion c on c.seccion_id = x.seccion_id and c.activo
    join seccion_planes_estudio sp on sp.id = c.seccion_plan_id and sp.vigencia @> b.fin
    join asignatura_competencias ac on ac.plan_id = c.plan_id and ac.asignatura_id = c.asignatura_id
    join matricula_secciones ms on ms.seccion_id = x.seccion_id and ms.vigencia @> b.fin
    join matriculas m on m.id = ms.matricula_id and m.confirmada_en is not null and m.estado <> 'anulada'
    left join calificaciones_competencia cc
      on cc.matricula_id = ms.matricula_id and cc.bimestre_id = x.bimestre_id and cc.competencia_id = ac.competencia_id
    join asignaturas a on a.id = c.asignatura_id
    join secciones s on s.id = x.seccion_id
    join grados g on g.id = s.grado_id
    join niveles n on n.id = g.nivel_id
    where x.estado = 'borrador'
      and exists (
        select 1 from asignaciones_docentes ad
        where ad.curso_id = c.id and ad.docente_id = ${docenteId}::bigint
          and ad.vigencia && daterange(b.inicio, b.fin, '[]')
      )
    group by x.id, b.numero, c.id, a.nombre, s.nombre, g.numero, n.nombre, n.id
    having count(*) filter (where cc.estado is null or cc.estado = 'pendiente') > 0
    order by b.numero, n.id, g.numero, s.nombre, a.nombre
  `.execute(db());
  return r.rows.map((f) => ({ ...f, esperadas: Number(f.esperadas), pendientes: Number(f.pendientes) }));
}

// ------------------------------------------------------- Portal estudiante / padres

export async function datosEstudiante(estudianteId: string) {
  return db()
    .selectFrom('estudiantes as e')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select(['e.id', 'e.codigo', 'p.nombres', 'p.apellidos'])
    .where('e.id', '=', estudianteId)
    .executeTakeFirst();
}

/** Matrícula del año en curso (o la más reciente) con su sección vigente. */
export async function matriculaActual(estudianteId: string, hoy: string): Promise<MatriculaInicio | null> {
  const r = await sql<MatriculaInicio>`
    select m.id, a.anio, n.nombre as nivel, g.numero as grado, m.estado,
           (select s.nombre from matricula_secciones ms join secciones s on s.id = ms.seccion_id
             where ms.matricula_id = m.id
             order by (ms.vigencia @> ${hoy}::date) desc, lower(ms.vigencia) desc limit 1) as seccion
    from matriculas m
    join anios_academicos a on a.id = m.anio_id
    join grados g on g.id = m.grado_id
    join niveles n on n.id = g.nivel_id
    where m.estudiante_id = ${estudianteId}::bigint and m.estado <> 'anulada'
    order by (${hoy}::date between a.inicio and a.fin) desc, a.anio desc
    limit 1
  `.execute(db());
  return r.rows[0] ?? null;
}

/** Último nivel de logro publicado por competencia (vista ultimos_logros_publicados). */
export async function ultimosLogros(matriculaId: string, limite = 12): Promise<LogroReciente[]> {
  const filas = await db()
    .selectFrom('ultimos_logros_publicados as u')
    .innerJoin('competencias as k', 'k.id', 'u.competencia_id')
    .leftJoin('areas_curriculares as ar', 'ar.id', 'k.area_id')
    .select(['u.competencia_id', 'k.nombre as competencia', 'ar.nombre as area', 'u.bimestre', 'u.nivel_logro', 'u.conclusion'])
    .where('u.matricula_id', '=', matriculaId)
    .orderBy('u.bimestre', 'desc')
    .orderBy('ar.nombre')
    .orderBy('k.nombre')
    .limit(limite)
    .execute();
  return filas.map((f) => ({
    competencia_id: String(f.competencia_id),
    competencia: f.competencia,
    area: f.area,
    bimestre: Number(f.bimestre ?? 0),
    nivel_logro: f.nivel_logro ?? '',
    conclusion: f.conclusion,
  }));
}

/** Conteo de estados diarios (vista asistencia_diaria_estudiantes) de la matrícula en el rango. */
export async function asistenciaMatricula(matriculaId: string, desde: string, hasta: string): Promise<ResumenAsistencia> {
  const r = await sql<Record<keyof ResumenAsistencia, string>>`
    select count(*) as esperadas,
           count(*) filter (where estado = 'presente') as presentes,
           count(*) filter (where estado = 'tarde') as tardanzas,
           count(*) filter (where estado = 'ausente') as ausencias,
           count(*) filter (where estado = 'justificado') as justificadas,
           count(*) filter (where estado = 'pendiente') as pendientes
    from asistencia_diaria_estudiantes
    where matricula_id = ${matriculaId}::bigint and fecha between ${desde}::date and ${hasta}::date
  `.execute(db());
  const f = r.rows[0];
  return {
    esperadas: Number(f?.esperadas ?? 0),
    presentes: Number(f?.presentes ?? 0),
    tardanzas: Number(f?.tardanzas ?? 0),
    ausencias: Number(f?.ausencias ?? 0),
    justificadas: Number(f?.justificadas ?? 0),
    pendientes: Number(f?.pendientes ?? 0),
  };
}

/** Deuda del estudiante en todas sus matrículas (vista saldos_cuotas). */
export async function deudaEstudiante(estudianteId: string, hoy: string): Promise<ResumenDeuda> {
  const r = await sql<{ total: string; vencido: string; cuotas: string; proxima_fecha: string | null; proxima_saldo: string | null }>`
    with s as (
      select sc.* from saldos_cuotas sc join matriculas m on m.id = sc.matricula_id
      where m.estudiante_id = ${estudianteId}::bigint
    ), proxima as (
      select vence_en, saldo from s where saldo > 0 and vence_en >= ${hoy}::date order by vence_en, cuota_id limit 1
    )
    select coalesce(sum(greatest(s.saldo, 0)), 0)::text as total,
           coalesce(sum(s.saldo) filter (where s.vence_en < ${hoy}::date and s.saldo > 0), 0)::text as vencido,
           count(*) filter (where s.saldo > 0) as cuotas,
           (select vence_en::text from proxima) as proxima_fecha,
           (select saldo::text from proxima) as proxima_saldo
    from s
  `.execute(db());
  const f = r.rows[0];
  return {
    total: f?.total ?? '0',
    vencido: f?.vencido ?? '0',
    cuotasPendientes: Number(f?.cuotas ?? 0),
    proximoVencimiento: f?.proxima_fecha ? { fecha: f.proxima_fecha, saldo: f.proxima_saldo ?? '0' } : null,
  };
}
