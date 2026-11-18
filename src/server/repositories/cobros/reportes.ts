import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaMorosidad } from '@/esquemas/cobros/reportes';
import { GRADO_TEXTO, medioUi, nombreAlumno, ordenConcepto, seccionActual, seccionActualId } from './comunes';

// Repositorio: morosidad al corte (función reporte_cuotas_al_corte) y recaudación por rango.

interface FilaCorte {
  cuota_id: string;
  matricula_id: string;
  grado_id: string;
  concepto: string;
  vence_en: string;
  importe: string;
  ajustes: string;
  abonado: string;
  saldo: string;
}

export interface FiltrosMorosidad {
  anioId: string;
  corte: string;
  gradoId?: string;
  seccionId?: string;
  concepto?: string;
  soloVencidas: boolean;
  q?: string;
}

function consultaCorte(f: FiltrosMorosidad) {
  const corte = sql<FilaCorte>`reporte_cuotas_al_corte(${f.anioId}::bigint, ${f.corte}::date)`.as('r');
  let q = db()
    .selectFrom(corte)
    .innerJoin('cuotas as c', 'c.id', 'r.cuota_id')
    .innerJoin('matriculas as m', 'm.id', 'r.matricula_id')
    .innerJoin('estudiantes as e', 'e.id', 'm.estudiante_id')
    .innerJoin('personas as pe', 'pe.id', 'e.persona_id')
    .innerJoin('grados as g', 'g.id', 'r.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .where(sql<boolean>`r.saldo > 0`);
  if (f.soloVencidas) q = q.where(sql<boolean>`r.vence_en < ${f.corte}::date`);
  if (f.gradoId) q = q.where('r.grado_id', '=', f.gradoId);
  if (f.concepto) q = q.where('r.concepto', '=', f.concepto);
  if (f.seccionId) q = q.where(sql<boolean>`${seccionActualId('m')} = ${f.seccionId}::bigint`);
  if (f.q) q = q.where(sql<boolean>`(pe.apellidos || ' ' || pe.nombres || ' ' || e.codigo) ilike ${`%${f.q}%`}`);
  return q;
}

export async function morosidad(f: FiltrosMorosidad, p: Paginacion | null) {
  const total = await consultaCorte(f)
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    consultaCorte(f)
      .select([
        'r.cuota_id',
        'r.matricula_id',
        'e.id as estudiante_id',
        nombreAlumno('pe').as('alumno'),
        'e.codigo',
        GRADO_TEXTO.as('grado'),
        seccionActual('m').as('seccion'),
        'r.concepto',
        'c.numero',
        'c.mes_servicio',
        'r.vence_en',
        sql<string>`r.importe::numeric(12,2)`.as('importe'),
        sql<string>`r.ajustes::numeric(12,2)`.as('ajustes'),
        sql<string>`r.abonado::numeric(12,2)`.as('abonado'),
        sql<string>`r.saldo::numeric(12,2)`.as('saldo'),
        sql<number>`greatest(${f.corte}::date - r.vence_en, 0)`.as('dias_atraso'),
      ])
      .orderBy('g.nivel_id')
      .orderBy('g.numero')
      .orderBy('pe.apellidos')
      .orderBy('pe.nombres')
      .orderBy('r.vence_en')
      .orderBy(ordenConcepto('r.concepto')),
    p,
  ).execute();
  return { filas: filas.map((x): FilaMorosidad => ({ ...x, dias_atraso: Number(x.dias_atraso) })), total: Number(total.n) };
}

export async function resumenMorosidad(f: FiltrosMorosidad) {
  return consultaCorte({ ...f, soloVencidas: false })
    .select([
      sql<string>`count(*) filter (where ${f.soloVencidas ? sql`r.vence_en < ${f.corte}::date` : sql`true`})`.as('cuotas'),
      sql<string>`count(distinct r.matricula_id) filter (where ${f.soloVencidas ? sql`r.vence_en < ${f.corte}::date` : sql`true`})`.as('alumnos'),
      sql<string>`coalesce(sum(r.saldo), 0)`.as('saldo'),
      sql<string>`coalesce(sum(r.saldo) filter (where r.vence_en < ${f.corte}::date), 0)`.as('vencido'),
    ])
    .executeTakeFirstOrThrow();
}

/** Cantidad de pagos por medio (Yape/Plin reconocidos por la referencia) en el rango. */
export async function conteoPorMedio(desde: string, hasta: string) {
  return db()
    .selectFrom('pagos as p')
    .select([medioUi('p').as('medio'), sql<string>`count(*)`.as('pagos')])
    .where(sql<boolean>`(p.pagado_en at time zone 'America/Lima')::date between ${desde}::date and ${hasta}::date`)
    .groupBy(medioUi('p'))
    .execute();
}

/** Pagos cobrados por día (America/Lima) y medio, con reversiones y devoluciones del mismo día. */
export async function recaudacionPorDia(desde: string, hasta: string) {
  const r = await sql<{
    fecha: string;
    efectivo: string;
    transferencia: string;
    yape: string;
    plin: string;
    tarjeta: string;
    otro: string;
    cobrado: string;
    pagos: string;
    revertido: string;
    devuelto: string;
  }>`
    with dias as (
      select d::date as fecha from generate_series(${desde}::date, ${hasta}::date, interval '1 day') d
    ), cobros as (
      select (p.pagado_en at time zone 'America/Lima')::date as fecha, ${medioUi('p')} as medio, p.importe
      from pagos p
      where (p.pagado_en at time zone 'America/Lima')::date between ${desde}::date and ${hasta}::date
    ), reversiones as (
      select (r.revertido_en at time zone 'America/Lima')::date as fecha, sum(p.importe) as total
      from reversiones_pago r join pagos p on p.id = r.pago_id
      where (r.revertido_en at time zone 'America/Lima')::date between ${desde}::date and ${hasta}::date
      group by 1
    ), devoluciones_dia as (
      select (d.devuelto_en at time zone 'America/Lima')::date as fecha, sum(d.importe) as total
      from devoluciones d
      where (d.devuelto_en at time zone 'America/Lima')::date between ${desde}::date and ${hasta}::date
      group by 1
    )
    select to_char(x.fecha, 'YYYY-MM-DD') as fecha,
      coalesce(sum(c.importe) filter (where c.medio = 'efectivo'), 0) as efectivo,
      coalesce(sum(c.importe) filter (where c.medio = 'transferencia'), 0) as transferencia,
      coalesce(sum(c.importe) filter (where c.medio = 'yape'), 0) as yape,
      coalesce(sum(c.importe) filter (where c.medio = 'plin'), 0) as plin,
      coalesce(sum(c.importe) filter (where c.medio = 'tarjeta'), 0) as tarjeta,
      coalesce(sum(c.importe) filter (where c.medio = 'otro'), 0) as otro,
      coalesce(sum(c.importe), 0) as cobrado,
      count(c.importe) as pagos,
      coalesce(max(rv.total), 0) as revertido,
      coalesce(max(dv.total), 0) as devuelto
    from dias x
    left join cobros c on c.fecha = x.fecha
    left join reversiones rv on rv.fecha = x.fecha
    left join devoluciones_dia dv on dv.fecha = x.fecha
    group by x.fecha
    order by x.fecha`.execute(db());
  return r.rows;
}
