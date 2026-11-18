import 'server-only';
import { db, sql } from '@/server/db';
import { aplicarPaginacion, type Paginacion } from '@/server/http/listado';
import type { DetalleUsuario, FilaUsuario, RolDisponible } from '@/esquemas/identidad/usuarios';
import { normalizarTexto } from './personas';

// Repositorio de cuentas de usuario y roles. Sesiones/tokens se emiten con el servicio de auth.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function listarUsuarios(filtros: { q?: string; estado?: string; rol?: string; id?: string }, p: Paginacion | null) {
  const base = () => {
    let q = db().selectFrom('usuarios as u').innerJoin('personas as p', 'p.id', 'u.persona_id');
    if (filtros.id) q = q.where('u.id', '=', filtros.id);
    if (filtros.estado) q = q.where('u.estado', '=', filtros.estado);
    if (filtros.rol) {
      const rol = filtros.rol;
      q = q.where((eb) =>
        eb.exists(
          eb
            .selectFrom('usuario_roles as ur')
            .innerJoin('roles as r', 'r.id', 'ur.rol_id')
            .select('ur.rol_id')
            .whereRef('ur.usuario_id', '=', 'u.id')
            .where('r.codigo', '=', rol),
        ),
      );
    }
    for (const t of normalizarTexto(filtros.q ?? '').split(/\s+/).filter(Boolean).slice(0, 5)) {
      q = q.where((eb) =>
        eb.or([
          eb('u.login', 'like', `%${t}%`),
          eb(sql<string>`translate(lower(p.apellidos || ' ' || p.nombres), 'áéíóúüñ', 'aeiouun')`, 'like', `%${t}%`),
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
    return q;
  };
  const total = await base().select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow();
  const filas = await aplicarPaginacion(
    base()
      .select((eb) => [
        'u.id',
        'u.login',
        'u.estado',
        'u.persona_id',
        'u.ultimo_acceso',
        'p.nombres',
        'p.apellidos',
        sql<boolean>`nullif(btrim(u.contrasena_hash), '') is not null`.as('tiene_contrasena'),
        eb
          .selectFrom('usuario_roles as ur')
          .innerJoin('roles as r', 'r.id', 'ur.rol_id')
          .select(sql<string[]>`coalesce(array_agg(r.codigo order by r.codigo), '{}')`.as('x'))
          .whereRef('ur.usuario_id', '=', 'u.id')
          .as('roles'),
        eb
          .selectFrom('usuario_roles as ur')
          .innerJoin('roles as r', 'r.id', 'ur.rol_id')
          .select(sql<string>`string_agg(r.nombre, ', ' order by r.nombre)`.as('x'))
          .whereRef('ur.usuario_id', '=', 'u.id')
          .as('roles_texto'),
        eb
          .selectFrom('sesiones as s')
          .select((e) => e.fn.countAll<string>().as('n'))
          .whereRef('s.usuario_id', '=', 'u.id')
          .where('s.revocada_en', 'is', null)
          .where('s.expira_en', '>', sql<Date>`now()`)
          .as('sesiones_activas'),
      ])
      .orderBy('p.apellidos')
      .orderBy('p.nombres')
      .orderBy('u.id'),
    p,
  ).execute();
  return {
    filas: filas.map(
      (f): FilaUsuario => ({
        id: f.id,
        login: f.login,
        estado: f.estado,
        persona_id: f.persona_id,
        nombres: f.nombres,
        apellidos: f.apellidos,
        roles: f.roles ?? [],
        roles_texto: f.roles_texto ?? '',
        ultimo_acceso: iso(f.ultimo_acceso),
        sesiones_activas: Number(f.sesiones_activas ?? 0),
        tiene_contrasena: Boolean(f.tiene_contrasena),
      }),
    ),
    total: Number(total.n),
  };
}

export async function obtenerUsuario(id: string) {
  return db()
    .selectFrom('usuarios')
    .select(['id', 'persona_id', 'login', 'estado', sql<boolean>`nullif(btrim(contrasena_hash), '') is not null`.as('tiene_contrasena')])
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function obtenerDetalleUsuario(id: string): Promise<DetalleUsuario | undefined> {
  const { filas } = await listarUsuarios({ id }, { limite: 1, desplazamiento: 0 });
  const fila = filas[0];
  if (!fila) return undefined;
  const persona = await db().selectFrom('personas').select('correo_contacto').where('id', '=', fila.persona_id).executeTakeFirstOrThrow();
  const sesiones = await db()
    .selectFrom('sesiones')
    .select(['id', 'creada_en', 'expira_en'])
    .where('usuario_id', '=', id)
    .where('revocada_en', 'is', null)
    .where('expira_en', '>', sql<Date>`now()`)
    .orderBy('creada_en', 'desc')
    .limit(20)
    .execute();
  const tokens = await db()
    .selectFrom('tokens_acceso as t')
    .leftJoin('usuarios as e', 'e.id', 't.emisor_id')
    .select(['t.id', 't.proposito', 't.emitido_en', 't.expira_en', 'e.login as emisor'])
    .where('t.usuario_id', '=', id)
    .where('t.consumido_en', 'is', null)
    .where('t.revocado_en', 'is', null)
    .where('t.expira_en', '>', sql<Date>`now()`)
    .orderBy('t.emitido_en', 'desc')
    .execute();
  const permisos = await permisosDeRoles(fila.roles);
  return {
    ...fila,
    correo_contacto: persona.correo_contacto,
    permisos,
    sesiones: sesiones.map((s) => ({ id: s.id, creada_en: s.creada_en.toISOString(), expira_en: s.expira_en.toISOString() })),
    tokens: tokens.map((t) => ({
      id: t.id,
      proposito: t.proposito,
      emitido_en: t.emitido_en.toISOString(),
      expira_en: t.expira_en.toISOString(),
      emisor: t.emisor,
    })),
  };
}

export async function usuarioDePersona(personaId: string) {
  return db().selectFrom('usuarios').select(['id', 'login', 'estado']).where('persona_id', '=', personaId).executeTakeFirst();
}

export async function crearUsuario(d: { personaId: string; login: string }) {
  return db()
    .insertInto('usuarios')
    .values({ persona_id: d.personaId, login: d.login, estado: 'pendiente', contrasena_hash: null })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export async function listarRoles(): Promise<RolDisponible[]> {
  const roles = await db().selectFrom('roles').select(['id', 'codigo', 'nombre']).orderBy('id').execute();
  const permisos = await db()
    .selectFrom('rol_permisos as rp')
    .innerJoin('permisos as p', 'p.id', 'rp.permiso_id')
    .select(['rp.rol_id', 'p.codigo'])
    .orderBy('p.codigo')
    .execute();
  return roles.map((r) => ({ ...r, permisos: permisos.filter((p) => p.rol_id === r.id).map((p) => p.codigo) }));
}

export async function rolesPorCodigo(codigos: string[]) {
  if (codigos.length === 0) return [];
  return db().selectFrom('roles').select(['id', 'codigo']).where('codigo', 'in', codigos).execute();
}

export async function codigosRolesDeUsuario(usuarioId: string) {
  const filas = await db()
    .selectFrom('usuario_roles as ur')
    .innerJoin('roles as r', 'r.id', 'ur.rol_id')
    .select(['r.id', 'r.codigo'])
    .where('ur.usuario_id', '=', usuarioId)
    .execute();
  return filas;
}

/** Permisos efectivos (unión) de un conjunto de roles por código. */
export async function permisosDeRoles(codigos: string[]): Promise<string[]> {
  if (codigos.length === 0) return [];
  const filas = await db()
    .selectFrom('rol_permisos as rp')
    .innerJoin('roles as r', 'r.id', 'rp.rol_id')
    .innerJoin('permisos as p', 'p.id', 'rp.permiso_id')
    .select('p.codigo')
    .distinct()
    .where('r.codigo', 'in', codigos)
    .orderBy('p.codigo')
    .execute();
  return filas.map((f) => f.codigo);
}

export async function agregarRol(usuarioId: string, rolId: string) {
  await db().insertInto('usuario_roles').values({ usuario_id: usuarioId, rol_id: rolId }).onConflict((oc) => oc.doNothing()).execute();
}

export async function quitarRol(usuarioId: string, rolId: string) {
  await db().deleteFrom('usuario_roles').where('usuario_id', '=', usuarioId).where('rol_id', '=', rolId).execute();
}

export async function cambiarEstado(usuarioId: string, estado: 'pendiente' | 'activo' | 'suspendido') {
  return db().updateTable('usuarios').set({ estado }).where('id', '=', usuarioId).returning(['id', 'estado']).executeTakeFirst();
}

/** Revoca las sesiones vigentes (opcionalmente conservando una) y devuelve cuántas se cerraron. */
export async function revocarSesiones(usuarioId: string, excepto?: string) {
  let q = db()
    .updateTable('sesiones')
    .set({ revocada_en: sql`now()` })
    .where('usuario_id', '=', usuarioId)
    .where('revocada_en', 'is', null)
    .where('expira_en', '>', sql<Date>`now()`);
  if (excepto) q = q.where('id', '<>', excepto);
  const r = await q.returning('id').execute();
  return r.length;
}

/** Revoca enlaces de activación/recuperación pendientes (p. ej. al suspender la cuenta). */
export async function revocarTokens(usuarioId: string) {
  await db()
    .updateTable('tokens_acceso')
    .set({ revocado_en: sql`now()` })
    .where('usuario_id', '=', usuarioId)
    .where('consumido_en', 'is', null)
    .where('revocado_en', 'is', null)
    .execute();
}
