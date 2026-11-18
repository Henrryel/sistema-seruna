import 'server-only';
import { db, sql } from '@/server/db';
import type { DatosDocumentoIdentidad, PersonaEncontrada } from '@/esquemas/matricula/comunes';

// Personas y documentos de identidad usados por matrícula (alumnos, apoderados, responsables).

export const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : d);

/** Escapa comodines de LIKE. */
export const patronLike = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function buscarPersonas(q: string, limite = 10): Promise<PersonaEncontrada[]> {
  const patron = patronLike(q);
  return db()
    .selectFrom('personas as p')
    .select((eb) => [
      'p.id',
      'p.nombres',
      'p.apellidos',
      'p.fecha_nacimiento',
      'p.telefono',
      eb.selectFrom('estudiantes as e').select('e.id').whereRef('e.persona_id', '=', 'p.id').as('estudiante_id'),
      sql<string | null>`(select string_agg(d.tipo || ' ' || d.numero, ', ' order by d.id) from documentos_identidad d where d.persona_id = p.id)`.as(
        'documentos',
      ),
    ])
    .where((eb) =>
      eb.or([
        sql<boolean>`(p.apellidos || ' ' || p.nombres) ilike ${patron}`,
        sql<boolean>`(p.nombres || ' ' || p.apellidos) ilike ${patron}`,
        eb.exists(
          eb
            .selectFrom('documentos_identidad as d')
            .select('d.id')
            .whereRef('d.persona_id', '=', 'p.id')
            .where('d.numero', 'like', patronLike(q.toUpperCase())),
        ),
      ]),
    )
    .orderBy('p.apellidos')
    .orderBy('p.nombres')
    .limit(limite)
    .execute();
}

export async function obtenerPersona(id: string) {
  return db().selectFrom('personas').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function crearPersona(d: {
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}) {
  return db()
    .insertInto('personas')
    .values({
      nombres: d.nombres,
      apellidos: d.apellidos,
      fecha_nacimiento: d.fechaNacimiento ?? null,
      correo_contacto: d.correo ?? null,
      telefono: d.telefono ?? null,
      direccion: d.direccion ?? null,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarPersona(
  id: string,
  d: { nombres: string; apellidos: string; fechaNacimiento?: string | null; correo: string | null; telefono: string | null; direccion: string | null },
) {
  return db()
    .updateTable('personas')
    .set({
      nombres: d.nombres,
      apellidos: d.apellidos,
      fecha_nacimiento: d.fechaNacimiento ?? null,
      correo_contacto: d.correo,
      telefono: d.telefono,
      direccion: d.direccion,
    })
    .where('id', '=', id)
    .returning(['id'])
    .executeTakeFirst();
}

export async function crearDocumentoIdentidad(personaId: string, d: DatosDocumentoIdentidad) {
  return db()
    .insertInto('documentos_identidad')
    .values({ persona_id: personaId, tipo: d.tipo, numero: d.numero, pais_emisor: d.paisEmisor })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function documentosDePersona(personaId: string) {
  const filas = await db()
    .selectFrom('documentos_identidad')
    .select(['id', 'tipo', 'numero', 'pais_emisor', 'verificado_en'])
    .where('persona_id', '=', personaId)
    .orderBy('id')
    .execute();
  return filas.map((f) => ({ ...f, verificado_en: iso(f.verificado_en) }));
}

export async function usuarioDePersona(personaId: string) {
  return (
    (await db().selectFrom('usuarios').select(['id', 'login', 'estado']).where('persona_id', '=', personaId).executeTakeFirst()) ?? null
  );
}

/** Texto "TIPO NÚMERO" del primer documento (para listados y PDF). */
export const PRIMER_DOCUMENTO = (personaRef: string) =>
  sql<string | null>`(select d.tipo || ' ' || d.numero from documentos_identidad d where d.persona_id = ${sql.ref(personaRef)} order by (d.tipo = 'DNI') desc, d.id limit 1)`;
