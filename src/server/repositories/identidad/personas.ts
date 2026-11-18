import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { DatosDocumento, DatosPersona, DetallePersona, FilaPersona } from '@/esquemas/identidad/personas';

// Repositorio de personas y documentos de identidad (único lugar con SQL del módulo).

/** Texto sin tildes y en minúsculas (misma normalización que `normalizarSql`). */
export function normalizarTexto(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const NOMBRE_NORMALIZADO = sql<string>`translate(lower(p.apellidos || ' ' || p.nombres), 'áéíóúüñ', 'aeiouun')`;

export async function listarPersonas(filtros: { q?: string; perfil?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('personas as p');
    const terminos = normalizarTexto(filtros.q ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5);
    for (const t of terminos) {
      q = q.where((eb) =>
        eb.or([
          eb(NOMBRE_NORMALIZADO, 'like', `%${t}%`),
          eb.exists(
            eb
              .selectFrom('documentos_identidad as d')
              .select('d.id')
              .whereRef('d.persona_id', '=', 'p.id')
              .where('d.numero', 'like', `%${t.toUpperCase()}%`),
          ),
        ]),
      );
    }
    if (filtros.perfil === 'con_usuario') q = q.where((eb) => eb.exists(eb.selectFrom('usuarios as u').select('u.id').whereRef('u.persona_id', '=', 'p.id')));
    if (filtros.perfil === 'sin_usuario') q = q.where((eb) => eb.not(eb.exists(eb.selectFrom('usuarios as u').select('u.id').whereRef('u.persona_id', '=', 'p.id'))));
    if (filtros.perfil === 'estudiante') q = q.where((eb) => eb.exists(eb.selectFrom('estudiantes as e').select('e.id').whereRef('e.persona_id', '=', 'p.id')));
    if (filtros.perfil === 'docente') q = q.where((eb) => eb.exists(eb.selectFrom('docentes as dc').select('dc.id').whereRef('dc.persona_id', '=', 'p.id')));
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .leftJoin('usuarios as u', 'u.persona_id', 'p.id')
      .select((eb) => [
        'p.id',
        'p.nombres',
        'p.apellidos',
        'p.fecha_nacimiento',
        'p.correo_contacto',
        'p.telefono',
        'u.id as usuario_id',
        'u.login as usuario_login',
        'u.estado as usuario_estado',
        eb
          .selectFrom('documentos_identidad as d')
          .select(sql<string>`string_agg(d.tipo || ' ' || d.numero, ', ' order by d.id)`.as('t'))
          .whereRef('d.persona_id', '=', 'p.id')
          .as('documentos'),
        eb.exists(eb.selectFrom('estudiantes as e').select('e.id').whereRef('e.persona_id', '=', 'p.id')).as('es_estudiante'),
        eb.exists(eb.selectFrom('docentes as dc').select('dc.id').whereRef('dc.persona_id', '=', 'p.id')).as('es_docente'),
      ])
      .orderBy('p.apellidos')
      .orderBy('p.nombres')
      .orderBy('p.id'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaPersona => ({
        ...f,
        documentos: f.documentos ?? '',
        es_estudiante: Boolean(f.es_estudiante),
        es_docente: Boolean(f.es_docente),
      }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerPersona(id: string): Promise<DetallePersona | undefined> {
  const p = await db()
    .selectFrom('personas as p')
    .leftJoin('usuarios as u', 'u.persona_id', 'p.id')
    .select((eb) => [
      'p.id',
      'p.nombres',
      'p.apellidos',
      'p.fecha_nacimiento',
      'p.correo_contacto',
      'p.telefono',
      'p.direccion',
      'p.creado_en',
      'u.id as usuario_id',
      'u.login as usuario_login',
      'u.estado as usuario_estado',
      eb.exists(eb.selectFrom('estudiantes as e').select('e.id').whereRef('e.persona_id', '=', 'p.id')).as('es_estudiante'),
      eb.exists(eb.selectFrom('docentes as dc').select('dc.id').whereRef('dc.persona_id', '=', 'p.id')).as('es_docente'),
    ])
    .where('p.id', '=', id)
    .executeTakeFirst();
  if (!p) return undefined;
  const documentos = await db()
    .selectFrom('documentos_identidad')
    .select(['id', 'tipo', 'pais_emisor', 'numero', 'verificado_en'])
    .where('persona_id', '=', id)
    .orderBy('id')
    .execute();
  return {
    id: p.id,
    nombres: p.nombres,
    apellidos: p.apellidos,
    fecha_nacimiento: p.fecha_nacimiento,
    correo_contacto: p.correo_contacto,
    telefono: p.telefono,
    direccion: p.direccion,
    creado_en: p.creado_en.toISOString(),
    usuario: p.usuario_id && p.usuario_login && p.usuario_estado ? { id: p.usuario_id, login: p.usuario_login, estado: p.usuario_estado } : null,
    es_estudiante: Boolean(p.es_estudiante),
    es_docente: Boolean(p.es_docente),
    documentos: documentos.map((d) => ({ ...d, verificado_en: d.verificado_en ? d.verificado_en.toISOString() : null })),
  };
}

function valoresPersona(d: DatosPersona) {
  return {
    nombres: d.nombres,
    apellidos: d.apellidos,
    fecha_nacimiento: d.fechaNacimiento ?? null,
    correo_contacto: d.correoContacto,
    telefono: d.telefono,
    direccion: d.direccion,
  };
}

export async function crearPersona(d: DatosPersona) {
  return db().insertInto('personas').values(valoresPersona(d)).returning(['id']).executeTakeFirstOrThrow();
}

export async function actualizarPersona(id: string, d: DatosPersona) {
  return db().updateTable('personas').set(valoresPersona(d)).where('id', '=', id).returning(['id']).executeTakeFirst();
}

export async function obtenerDocumento(id: string) {
  return db().selectFrom('documentos_identidad').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function crearDocumento(personaId: string, d: DatosDocumento) {
  return db()
    .insertInto('documentos_identidad')
    .values({
      persona_id: personaId,
      tipo: d.tipo,
      pais_emisor: d.paisEmisor,
      numero: d.numero,
      verificado_en: d.verificado ? sql<Date>`now()` : null,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function actualizarDocumento(id: string, d: DatosDocumento) {
  return db()
    .updateTable('documentos_identidad')
    .set({
      tipo: d.tipo,
      pais_emisor: d.paisEmisor,
      numero: d.numero,
      // Conserva la fecha de verificación original si ya estaba verificado.
      verificado_en: d.verificado ? sql<Date>`coalesce(verificado_en, now())` : null,
    })
    .where('id', '=', id)
    .returning(['id', 'persona_id'])
    .executeTakeFirst();
}

export async function eliminarDocumento(id: string) {
  return db().deleteFrom('documentos_identidad').where('id', '=', id).returning(['id', 'persona_id']).executeTakeFirst();
}
