import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { DatosAula, DatosSeccion, FilaAula, FilaGrado, FilaSeccion } from '@/esquemas/academico/secciones';
import { ETIQUETA_GRADO, HOY_LIMA } from './comunes';

/** Fecha de referencia de la sección: hoy acotado al año escolar (requiere alias a = anios_academicos). */
const FECHA_REF = sql<string>`least(greatest(${HOY_LIMA}, a.inicio), a.fin)`;

export async function listarSecciones(f: { q?: string; anioId?: string; gradoId?: string; activa?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db()
      .selectFrom('secciones as s')
      .innerJoin('anios_academicos as a', 'a.id', 's.anio_id')
      .innerJoin('grados as g', 'g.id', 's.grado_id')
      .innerJoin('niveles as n', 'n.id', 'g.nivel_id');
    if (f.anioId) q = q.where('s.anio_id', '=', f.anioId);
    if (f.gradoId) q = q.where('s.grado_id', '=', f.gradoId);
    if (f.activa) q = q.where('s.activa', '=', f.activa === 'true');
    if (f.q) q = q.where((eb) => eb.or([eb('s.nombre', 'like', `%${f.q?.toUpperCase()}%`), eb('s.turno', 'ilike', `%${f.q}%`)]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        's.id',
        's.anio_id',
        'a.anio',
        's.grado_id',
        ETIQUETA_GRADO.as('grado'),
        'n.nombre as nivel',
        's.nombre',
        's.turno',
        's.cupo',
        's.reserva',
        's.activa',
        FECHA_REF.as('fecha_ocupacion'),
        sql<string>`(select count(*) from matricula_secciones ms where ms.seccion_id = s.id and ms.vigencia @> ${FECHA_REF})`.as('ocupadas'),
        sql<string | null>`(select 'v' || pe.version from seccion_planes_estudio sp join planes_estudio pe on pe.id = sp.plan_id
            where sp.seccion_id = s.id and sp.vigencia @> ${FECHA_REF} limit 1)`.as('plan_vigente'),
        sql<string>`(select count(*) from cursos_seccion c where c.seccion_id = s.id and c.activo)`.as('cursos'),
      ])
      .orderBy('a.anio', 'desc')
      .orderBy('n.id')
      .orderBy('g.numero')
      .orderBy('s.nombre'),
    p,
  ).execute();
  return {
    filas: filas.map((r): FilaSeccion => ({ ...r, ocupadas: Number(r.ocupadas), cursos: Number(r.cursos) })),
    total: Number(total.n),
  };
}

export async function obtenerSeccion(id: string) {
  return db()
    .selectFrom('secciones as s')
    .innerJoin('anios_academicos as a', 'a.id', 's.anio_id')
    .select(['s.id', 's.anio_id', 's.grado_id', 's.nombre', 's.turno', 's.cupo', 's.reserva', 's.activa', 'a.inicio as anio_inicio', 'a.fin as anio_fin', FECHA_REF.as('fecha_ref')])
    .where('s.id', '=', id)
    .executeTakeFirst();
}

function valoresSeccion(d: DatosSeccion) {
  return { anio_id: d.anioId, grado_id: d.gradoId, nombre: d.nombre, turno: d.turno, cupo: d.cupo, reserva: d.reserva, activa: d.activa };
}

export async function crearSeccion(d: DatosSeccion) {
  return db().insertInto('secciones').values(valoresSeccion(d)).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarSeccion(id: string, d: DatosSeccion) {
  return db().updateTable('secciones').set(valoresSeccion(d)).where('id', '=', id).returning(['id']).executeTakeFirst();
}

/** Niveles y grados (sembrados, solo lectura) con totales de secciones del año indicado. */
export async function listarGrados(anioId?: string): Promise<FilaGrado[]> {
  const filas = await db()
    .selectFrom('grados as g')
    .innerJoin('niveles as n', 'n.id', 'g.nivel_id')
    .select([
      'g.id',
      'g.nivel_id',
      'n.nombre as nivel',
      'n.codigo as nivel_codigo',
      'g.numero',
      sql<string>`(select count(*) from secciones s where s.grado_id = g.id and s.activa and (${anioId ?? null}::bigint is null or s.anio_id = ${anioId ?? null}::bigint))`.as('secciones'),
      sql<string>`(select coalesce(sum(s.cupo), 0) from secciones s where s.grado_id = g.id and s.activa and (${anioId ?? null}::bigint is null or s.anio_id = ${anioId ?? null}::bigint))`.as('cupo_total'),
      sql<string>`(select count(*) from secciones s join anios_academicos a on a.id = s.anio_id join matricula_secciones ms on ms.seccion_id = s.id
          where s.grado_id = g.id and s.activa and ms.vigencia @> ${FECHA_REF}
            and (${anioId ?? null}::bigint is null or s.anio_id = ${anioId ?? null}::bigint))`.as('ocupadas'),
    ])
    .orderBy('n.id')
    .orderBy('g.numero')
    .execute();
  return filas.map((r) => ({ ...r, secciones: Number(r.secciones), cupo_total: Number(r.cupo_total), ocupadas: Number(r.ocupadas) }));
}

export async function listarAulas(f: { q?: string; activa?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('aulas as au');
    if (f.activa) q = q.where('au.activa', '=', f.activa === 'true');
    if (f.q) q = q.where((eb) => eb.or([eb('au.codigo', 'ilike', `%${f.q}%`), eb('au.nombre', 'ilike', `%${f.q}%`)]));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'au.id',
        'au.codigo',
        'au.nombre',
        'au.capacidad',
        'au.activa',
        sql<string>`(select count(*) from bloques_horario b where b.aula_id = au.id and upper(b.vigencia) > ${HOY_LIMA})`.as('bloques'),
      ])
      .orderBy('au.codigo'),
    p,
  ).execute();
  return { filas: filas.map((r): FilaAula => ({ ...r, bloques: Number(r.bloques) })), total: Number(total.n) };
}

function valoresAula(d: DatosAula) {
  return { codigo: d.codigo, nombre: d.nombre, capacidad: d.capacidad, activa: d.activa };
}

export async function crearAula(d: DatosAula) {
  return db().insertInto('aulas').values(valoresAula(d)).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarAula(id: string, d: DatosAula) {
  return db().updateTable('aulas').set(valoresAula(d)).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function eliminarAula(id: string) {
  return db().deleteFrom('aulas').where('id', '=', id).returning(['id']).executeTakeFirst();
}
