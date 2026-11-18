import 'server-only';
import { db, sql } from '@/server/db';
import type { FilaApoderado } from '@/esquemas/matricula/apoderados';
import { iso, PRIMER_DOCUMENTO } from './personas';

const HOY = sql<string>`(now() at time zone 'America/Lima')::date`;

export async function listarApoderados(estudianteId: string, soloVigentes = false): Promise<FilaApoderado[]> {
  let q = db()
    .selectFrom('estudiante_apoderado as ea')
    .innerJoin('personas as p', 'p.id', 'ea.persona_id')
    .leftJoin('usuarios as v', 'v.id', 'ea.verificado_por')
    .leftJoin('usuarios as u', 'u.persona_id', 'ea.persona_id')
    .select([
      'ea.id',
      'ea.estudiante_id',
      'ea.persona_id',
      'p.nombres',
      'p.apellidos',
      'p.telefono',
      'p.correo_contacto',
      PRIMER_DOCUMENTO('p.id').as('documento'),
      'ea.parentesco',
      sql<string>`lower(ea.vigencia)`.as('desde'),
      sql<string | null>`upper(ea.vigencia) - 1`.as('hasta'),
      sql<boolean>`ea.vigencia @> ${HOY}`.as('vigente'),
      'ea.verificado_en',
      'v.login as verificado_por',
      'ea.evidencia_id',
      'ea.acceso_academico',
      'ea.acceso_economico',
      'u.login as usuario_login',
    ])
    .where('ea.estudiante_id', '=', estudianteId);
  if (soloVigentes) q = q.where(sql<boolean>`ea.vigencia @> ${HOY}`);
  const filas = await q.orderBy(sql`upper_inf(ea.vigencia)`, 'desc').orderBy(sql`lower(ea.vigencia)`, 'desc').execute();
  return filas.map((f) => ({ ...f, verificado_en: iso(f.verificado_en) }));
}

export async function obtenerVinculo(id: string) {
  return db()
    .selectFrom('estudiante_apoderado')
    .select([
      'id',
      'estudiante_id',
      'persona_id',
      'parentesco',
      'verificado_en',
      'verificado_por',
      'acceso_academico',
      'acceso_economico',
      sql<string>`lower(vigencia)`.as('desde'),
      sql<string | null>`upper(vigencia) - 1`.as('hasta'),
    ])
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function crearVinculo(d: { estudianteId: string; personaId: string; parentesco: string; desde: string; hasta: string | null }) {
  return db()
    .insertInto('estudiante_apoderado')
    .values({
      estudiante_id: d.estudianteId,
      persona_id: d.personaId,
      parentesco: d.parentesco,
      vigencia: sql<string>`daterange(${d.desde}::date, ${d.hasta}::date + 1, '[)')`,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function verificarVinculo(id: string, usuarioId: string, evidenciaId: string | null) {
  return db()
    .updateTable('estudiante_apoderado')
    .set({ verificado_por: usuarioId, verificado_en: sql`now()`, evidencia_id: evidenciaId })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function actualizarAccesos(id: string, academico: boolean, economico: boolean) {
  return db()
    .updateTable('estudiante_apoderado')
    .set({ acceso_academico: academico, acceso_economico: economico })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

/** Cierra la vigencia con fin INCLUSIVO `fin`. */
export async function terminarVinculo(id: string, fin: string) {
  return db()
    .updateTable('estudiante_apoderado')
    .set({ vigencia: sql<string>`daterange(lower(vigencia), ${fin}::date, '[]')` })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}
