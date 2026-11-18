import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FaltanteCierre, FilaCierre } from '@/esquemas/evaluacion/cierres';

// Cierres de evaluación por sección y bimestre. Transiciones y completitud las valida
// `validar_cierre_evaluacion` (trigger); el avance solo es informativo para la pantalla.

function base() {
  return db()
    .selectFrom('cierres_evaluacion as c')
    .innerJoin('secciones as s', 's.id', 'c.seccion_id')
    .innerJoin('grados as g', 'g.id', 's.grado_id')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .innerJoin('bimestres as b', 'b.id', 'c.bimestre_id')
    .innerJoin('usuarios as u', 'u.id', 'c.responsable_id');
}

type Base = ReturnType<typeof base>;

function seleccion(q: Base) {
  return q.select([
    'c.id',
    'c.seccion_id',
    's.nombre as seccion',
    'g.numero as grado',
    'n.nombre as nivel',
    'c.bimestre_id',
    'b.numero as bimestre',
    'c.estado',
    'c.cerrado_en',
    'c.publicado_en',
    'u.login as responsable',
    // Nómina al cierre del bimestre × competencias del plan vigente (misma definición que la base).
    sql<string>`(
      (select count(*) from matricula_secciones ms where ms.seccion_id = c.seccion_id and ms.vigencia @> b.fin)
      * (select count(*) from seccion_planes_estudio sp join plan_competencias pc on pc.plan_id = sp.plan_id
         where sp.seccion_id = c.seccion_id and sp.vigencia @> b.fin))`.as('esperadas'),
    sql<string>`(select count(*) from calificaciones_competencia x where x.cierre_id = c.id)`.as('registradas'),
    sql<string>`(select count(*) from matricula_secciones ms
        join seccion_planes_estudio sp on sp.seccion_id = c.seccion_id and sp.vigencia @> b.fin
        join plan_competencias pc on pc.plan_id = sp.plan_id
        join calificaciones_competencia x on x.cierre_id = c.id and x.matricula_id = ms.matricula_id and x.competencia_id = pc.competencia_id
       where ms.seccion_id = c.seccion_id and ms.vigencia @> b.fin)`.as('completas'),
    sql<string>`(select count(*) from calificaciones_competencia x where x.cierre_id = c.id and x.estado = 'pendiente')`.as('pendientes'),
    sql<string>`(select count(*) from calificaciones_competencia x where x.cierre_id = c.id
        and (x.nivel_logro = 'C' or (x.nivel_logro = 'B' and n.codigo = 'primaria'))
        and nullif(btrim(x.conclusion), '') is null)`.as('sin_conclusion'),
  ]);
}

function aFila(f: Awaited<ReturnType<ReturnType<typeof seleccion>['execute']>>[number]): FilaCierre {
  const esperadas = Number(f.esperadas ?? 0);
  const completas = Number(f.completas ?? 0);
  return {
    id: f.id,
    seccion_id: f.seccion_id,
    seccion: f.seccion,
    grado: f.grado,
    nivel: f.nivel,
    bimestre_id: f.bimestre_id,
    bimestre: f.bimestre,
    estado: f.estado,
    cerrado_en: f.cerrado_en ? f.cerrado_en.toISOString() : null,
    publicado_en: f.publicado_en ? f.publicado_en.toISOString() : null,
    responsable: f.responsable,
    esperadas,
    registradas: Number(f.registradas ?? 0),
    completas,
    pendientes: Number(f.pendientes ?? 0),
    sin_conclusion: Number(f.sin_conclusion ?? 0),
    avance: esperadas ? Math.min(100, Math.round((completas / esperadas) * 100)) : 0,
  };
}

export async function listarCierres(filtros: { anioId?: string; bimestreId?: string; estado?: string; q?: string }, p: Paginacion | null) {
  const filtrar = (q: Base) => {
    let r = q;
    if (filtros.anioId) r = r.where('c.anio_id', '=', filtros.anioId);
    if (filtros.bimestreId) r = r.where('c.bimestre_id', '=', filtros.bimestreId);
    if (filtros.estado) r = r.where('c.estado', '=', filtros.estado);
    if (filtros.q) r = r.where('s.nombre', 'ilike', `%${filtros.q}%`);
    return r;
  };
  const total = await filtrar(base()).select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    seleccion(filtrar(base())).orderBy('b.numero').orderBy('g.nivel_id').orderBy('g.numero').orderBy('s.nombre'),
    p,
  ).execute();
  return { filas: filas.map(aFila), total: Number(total.n) };
}

export async function obtenerCierre(id: string) {
  const f = await seleccion(base()).where('c.id', '=', id).executeTakeFirst();
  return f ? aFila(f) : undefined;
}

export async function obtenerCierreSimple(id: string) {
  return db().selectFrom('cierres_evaluacion').select(['id', 'estado', 'seccion_id', 'bimestre_id']).where('id', '=', id).executeTakeFirst();
}

/** Alumnos × competencias que impiden cerrar (sin nota, pendientes o sin conclusión obligatoria). */
export async function faltantesCierre(id: string, limite = 300) {
  const r = await sql<FaltanteCierre & { total: string }>`
    with c as (
      select x.id, x.seccion_id, b.fin, n.codigo as nivel
      from cierres_evaluacion x
      join bimestres b on b.id = x.bimestre_id
      join grados g on g.id = x.grado_id
      join niveles n on n.id = g.nivel_id
      where x.id = ${id}
    ), faltantes as (
      select ms.matricula_id, k.codigo || ' · ' || k.nombre as competencia, 'sin_nota'::text as motivo
      from c
      join matricula_secciones ms on ms.seccion_id = c.seccion_id and ms.vigencia @> c.fin
      join seccion_planes_estudio sp on sp.seccion_id = c.seccion_id and sp.vigencia @> c.fin
      join plan_competencias pc on pc.plan_id = sp.plan_id
      join competencias k on k.id = pc.competencia_id
      where not exists (select 1 from calificaciones_competencia q
                        where q.cierre_id = c.id and q.matricula_id = ms.matricula_id and q.competencia_id = pc.competencia_id)
      union all
      select q.matricula_id, k.codigo || ' · ' || k.nombre,
             case when q.estado = 'pendiente' then 'pendiente' else 'sin_conclusion' end
      from c
      join calificaciones_competencia q on q.cierre_id = c.id
      join competencias k on k.id = q.competencia_id
      where q.estado = 'pendiente'
         or ((q.nivel_logro = 'C' or (q.nivel_logro = 'B' and c.nivel = 'primaria')) and nullif(btrim(q.conclusion), '') is null)
    )
    select f.matricula_id, p.apellidos || ', ' || p.nombres as alumno, f.competencia, f.motivo, count(*) over () as total
    from faltantes f
    join matriculas m on m.id = f.matricula_id
    join estudiantes e on e.id = m.estudiante_id
    join personas p on p.id = e.persona_id
    order by p.apellidos, p.nombres, f.competencia
    limit ${limite}`.execute(db());
  return { faltantes: r.rows.map(({ total: _t, ...f }) => f), total: Number(r.rows[0]?.total ?? 0) };
}

/** Crea los cierres en borrador que falten (secciones activas del año del bimestre). */
export async function abrirCierres(bimestreId: string, responsableId: string, seccionIds?: string[]) {
  let secciones = db()
    .selectFrom('secciones as s')
    .innerJoin('bimestres as b', 'b.anio_id', 's.anio_id')
    .select([
      's.id as seccion_id',
      'b.id as bimestre_id',
      's.anio_id',
      's.grado_id',
      sql<string>`'borrador'`.as('estado'),
      sql<string>`${responsableId}::bigint`.as('responsable_id'),
    ])
    .where('b.id', '=', bimestreId)
    .where('s.activa', '=', true)
    .where(({ not, exists, selectFrom }) =>
      not(exists(selectFrom('cierres_evaluacion as x').select('x.id').whereRef('x.seccion_id', '=', 's.id').whereRef('x.bimestre_id', '=', 'b.id'))),
    );
  if (seccionIds?.length) secciones = secciones.where('s.id', 'in', seccionIds);
  return db()
    .insertInto('cierres_evaluacion')
    .columns(['seccion_id', 'bimestre_id', 'anio_id', 'grado_id', 'estado', 'responsable_id'])
    .expression(secciones)
    .returning(['id', 'seccion_id'])
    .execute();
}

export async function cambiarEstado(id: string, accion: 'cerrar' | 'publicar' | 'reabrir', responsableId: string) {
  const cambios =
    accion === 'cerrar'
      ? { estado: 'cerrado', cerrado_en: sql<Date>`clock_timestamp()`, publicado_en: null }
      : accion === 'publicar'
        ? { estado: 'publicado', publicado_en: sql<Date>`clock_timestamp()` }
        : // Reabrir: vuelve a borrador limpiando fechas (lo exigen los CHECK); el trigger audita la reapertura.
          { estado: 'borrador', cerrado_en: null, publicado_en: null };
  return db()
    .updateTable('cierres_evaluacion')
    .set({ ...cambios, responsable_id: responsableId })
    .where('id', '=', id)
    .returning(['id', 'estado'])
    .executeTakeFirst();
}
