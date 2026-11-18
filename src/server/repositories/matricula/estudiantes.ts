import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { FilaEstudiante } from '@/esquemas/matricula/estudiantes';
import { patronLike, PRIMER_DOCUMENTO } from './personas';

export async function listarEstudiantes(filtros: { q?: string; activo?: 'true' | 'false' }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('estudiantes as e').innerJoin('personas as p', 'p.id', 'e.persona_id');
    if (filtros.activo) q = q.where('e.activo', '=', filtros.activo === 'true');
    if (filtros.q) {
      const texto = filtros.q;
      const patron = patronLike(texto);
      q = q.where((eb) =>
        eb.or([
          sql<boolean>`(p.apellidos || ' ' || p.nombres) ilike ${patron}`,
          sql<boolean>`(p.nombres || ' ' || p.apellidos) ilike ${patron}`,
          eb('e.codigo', 'ilike', patron),
          eb('e.codigo_siagie', 'ilike', patron),
          eb.exists(
            eb
              .selectFrom('documentos_identidad as d')
              .select('d.id')
              .whereRef('d.persona_id', '=', 'p.id')
              .where('d.numero', 'like', patronLike(texto.toUpperCase())),
          ),
        ]),
      );
    }
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select([
        'e.id',
        'e.persona_id',
        'e.codigo',
        'e.codigo_siagie',
        'e.activo',
        'p.nombres',
        'p.apellidos',
        PRIMER_DOCUMENTO('p.id').as('documento'),
        sql<string | null>`(
          select a.anio || ' · ' || g.numero || '.º ' || n.nombre
          from matriculas m join anios_academicos a on a.id = m.anio_id
          join grados g on g.id = m.grado_id join niveles n on n.id = g.nivel_id
          where m.estudiante_id = e.id order by a.anio desc limit 1)`.as('ultima_matricula'),
        sql<string | null>`(
          select m.estado from matriculas m join anios_academicos a on a.id = m.anio_id
          where m.estudiante_id = e.id order by a.anio desc limit 1)`.as('estado_matricula'),
      ])
      .orderBy('p.apellidos')
      .orderBy('p.nombres'),
    p,
  ).execute();
  return { filas: filas as FilaEstudiante[], total: Number(total.n) };
}

export async function obtenerEstudiante(id: string) {
  return db()
    .selectFrom('estudiantes as e')
    .innerJoin('personas as p', 'p.id', 'e.persona_id')
    .select([
      'e.id',
      'e.persona_id',
      'e.codigo',
      'e.codigo_siagie',
      'e.activo',
      'p.nombres',
      'p.apellidos',
      'p.fecha_nacimiento',
      'p.correo_contacto',
      'p.telefono',
      'p.direccion',
    ])
    .where('e.id', '=', id)
    .executeTakeFirst();
}

export async function crearEstudiante(d: { personaId: string; codigo: string; codigoSiagie: string | null; activo: boolean }) {
  return db()
    .insertInto('estudiantes')
    .values({ persona_id: d.personaId, codigo: d.codigo, codigo_siagie: d.codigoSiagie, activo: d.activo })
    .returning(['id', 'persona_id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarEstudiante(id: string, d: { codigo: string; codigoSiagie: string | null; activo: boolean }) {
  return db()
    .updateTable('estudiantes')
    .set({ codigo: d.codigo, codigo_siagie: d.codigoSiagie, activo: d.activo })
    .where('id', '=', id)
    .returning(['id', 'persona_id'])
    .executeTakeFirst();
}
