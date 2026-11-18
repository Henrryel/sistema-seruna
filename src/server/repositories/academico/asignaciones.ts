import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaAsignacion, FilaCurso } from '@/esquemas/academico/asignaciones';
import { ETIQUETA_SECCION, HOY_LIMA, NOMBRE_DOCENTE, vigencia } from './comunes';

// Cursos de sección (asignatura del plan dictada en la sección) y asignaciones docentes con vigencia.

export async function listarCursos(f: { q?: string; anioId?: string; gradoId?: string; seccionId?: string; sinDocente?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('cursos_seccion as c')
      .innerJoin('secciones as s', 's.id', 'c.seccion_id')
      .innerJoin('anios_academicos as a', 'a.id', 's.anio_id')
      .innerJoin('grados as g', 'g.id', 's.grado_id')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
      .innerJoin('asignaturas as x', 'x.id', 'c.asignatura_id')
      .innerJoin('planes_estudio as pe', 'pe.id', 'c.plan_id')
      .innerJoin('seccion_planes_estudio as sp', 'sp.id', 'c.seccion_plan_id');
    if (f.anioId) q = q.where('s.anio_id', '=', f.anioId);
    if (f.gradoId) q = q.where('s.grado_id', '=', f.gradoId);
    if (f.seccionId) q = q.where('c.seccion_id', '=', f.seccionId);
    if (f.q) q = q.where((eb) => eb.or([eb('x.nombre', 'ilike', `%${f.q}%`), eb('x.codigo', 'ilike', `%${f.q}%`)]));
    if (f.sinDocente === 'true') {
      q = q.where((eb) =>
        eb.not(
          eb.exists(
            eb.selectFrom('asignaciones_docentes as ad').select('ad.id').whereRef('ad.curso_id', '=', 'c.id').where(sql<boolean>`upper(ad.vigencia) > ${HOY_LIMA}`),
          ),
        ),
      );
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'c.id',
        'c.seccion_id',
        ETIQUETA_SECCION.as('seccion'),
        'a.anio',
        'c.asignatura_id',
        'x.nombre as asignatura',
        'x.codigo as asignatura_codigo',
        'c.plan_id',
        'pe.version as plan_version',
        'sp.vigencia as plan_vigencia',
        'c.activo',
        sql<string | null>`(select string_agg(pd.apellidos || ', ' || pd.nombres || ' (' || ad.funcion || ')', '; ' order by ad.funcion, pd.apellidos)
            from asignaciones_docentes ad join docentes d on d.id = ad.docente_id join personas pd on pd.id = d.persona_id
            where ad.curso_id = c.id and ad.vigencia @> least(greatest(${HOY_LIMA}, lower(sp.vigencia)), upper(sp.vigencia) - 1))`.as('docentes'),
        sql<string>`(select count(*) from asignaciones_docentes ad where ad.curso_id = c.id)`.as('asignaciones'),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy('n.id')
      .orderBy('g.numero')
      .orderBy('s.nombre')
      .orderBy('x.nombre'),
    p,
  ).execute();
  return {
    filas: filas.map((r): FilaCurso => {
      const v = vigencia(r.plan_vigencia);
      return {
        id: r.id,
        seccion_id: r.seccion_id,
        seccion: r.seccion,
        anio: r.anio,
        asignatura_id: r.asignatura_id,
        asignatura: r.asignatura,
        asignatura_codigo: r.asignatura_codigo,
        plan_id: r.plan_id,
        plan_version: r.plan_version,
        plan_inicio: v.inicio,
        plan_fin: v.fin,
        activo: r.activo,
        docentes: r.docentes ?? '',
        asignaciones: Number(r.asignaciones),
      };
    }),
    total: Number(total.n),
  };
}

export async function obtenerCurso(id: string) {
  return db()
    .selectFrom('cursos_seccion as c')
    .innerJoin('seccion_planes_estudio as sp', 'sp.id', 'c.seccion_plan_id')
    .select(['c.id', 'c.seccion_id', 'c.plan_id', 'c.asignatura_id', 'c.activo', 'sp.vigencia as plan_vigencia'])
    .where('c.id', '=', id)
    .executeTakeFirst();
}

export async function cambiarEstadoCurso(id: string, activo: boolean) {
  return db().updateTable('cursos_seccion').set({ activo }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function listarAsignaciones(
  f: { q?: string; anioId?: string; seccionId?: string; cursoId?: string; docenteId?: string; funcion?: string },
  p: Paginacion | null,
) {
  const base = () => {
    let q = db()
      .selectFrom('asignaciones_docentes as ad')
      .innerJoin('cursos_seccion as c', 'c.id', 'ad.curso_id')
      .innerJoin('asignaturas as x', 'x.id', 'c.asignatura_id')
      .innerJoin('secciones as s', 's.id', 'c.seccion_id')
      .innerJoin('grados as g', 'g.id', 's.grado_id')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
      .innerJoin('docentes as d', 'd.id', 'ad.docente_id')
      .innerJoin('personas as pd', 'pd.id', 'd.persona_id');
    if (f.anioId) q = q.where('s.anio_id', '=', f.anioId);
    if (f.seccionId) q = q.where('c.seccion_id', '=', f.seccionId);
    if (f.cursoId) q = q.where('ad.curso_id', '=', f.cursoId);
    if (f.docenteId) q = q.where('ad.docente_id', '=', f.docenteId);
    if (f.funcion) q = q.where('ad.funcion', '=', f.funcion);
    if (f.q) {
      q = q.where((eb) =>
        eb.or([eb('x.nombre', 'ilike', `%${f.q}%`), eb(NOMBRE_DOCENTE, 'ilike', `%${f.q}%`), eb('d.codigo', 'ilike', `%${f.q}%`)]),
      );
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'ad.id',
        'ad.curso_id',
        'c.seccion_id',
        ETIQUETA_SECCION.as('seccion'),
        'x.nombre as asignatura',
        'ad.docente_id',
        NOMBRE_DOCENTE.as('docente'),
        'd.codigo as docente_codigo',
        'ad.funcion',
        'ad.vigencia',
        sql<boolean>`ad.vigencia @> ${HOY_LIMA}`.as('vigente'),
        sql<string>`(select count(*) from bloques_horario b where b.asignacion_id = ad.id)`.as('bloques'),
      ])
      .orderBy('s.anio_id', 'desc')
      .orderBy('n.id')
      .orderBy('g.numero')
      .orderBy('s.nombre')
      .orderBy('x.nombre')
      .orderBy(sql`lower(ad.vigencia)`),
    p,
  ).execute();
  return {
    filas: filas.map((r): FilaAsignacion => {
      const { vigencia: rangoTexto, bloques, vigente, ...resto } = r;
      return { ...resto, ...vigencia(rangoTexto), vigente: Boolean(vigente), bloques: Number(bloques) };
    }),
    total: Number(total.n),
  };
}

export async function obtenerAsignacion(id: string) {
  return db().selectFrom('asignaciones_docentes').select(['id', 'curso_id', 'docente_id', 'funcion', 'vigencia']).where('id', '=', id).executeTakeFirst();
}

export async function crearAsignacion(d: { cursoId: string; docenteId: string; funcion: string; vigencia: string }) {
  return db()
    .insertInto('asignaciones_docentes')
    .values({ curso_id: d.cursoId, docente_id: d.docenteId, funcion: d.funcion, vigencia: d.vigencia })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarAsignacion(id: string, d: { funcion: string; vigencia: string }) {
  return db().updateTable('asignaciones_docentes').set({ funcion: d.funcion, vigencia: d.vigencia }).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarAsignacion(id: string) {
  return db().deleteFrom('asignaciones_docentes').where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function docenteExiste(id: string) {
  const r = await db().selectFrom('docentes').select(['id', 'activo']).where('id', '=', id).executeTakeFirst();
  return r;
}
