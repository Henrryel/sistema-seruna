import 'server-only';
import { db, sql } from '@/server/db';

export async function buscarUsuarioPorLogin(login: string) {
  return db()
    .selectFrom('usuarios')
    .select(['id', 'persona_id', 'login', 'contrasena_hash', 'estado'])
    .where('login', '=', login)
    .executeTakeFirst();
}

export async function crearSesion(datos: { usuarioId: string; tokenHash: Buffer; expiraEn: Date }) {
  return db()
    .insertInto('sesiones')
    .values({ usuario_id: datos.usuarioId, token_hash: datos.tokenHash, expira_en: datos.expiraEn })
    .returning(['id', 'expira_en'])
    .executeTakeFirstOrThrow();
}

/** Sesión no revocada ni vencida, con datos del usuario y de su persona. */
export async function obtenerSesionVigente(tokenHash: Buffer) {
  return db()
    .selectFrom('sesiones as s')
    .innerJoin('usuarios as u', 'u.id', 's.usuario_id')
    .innerJoin('personas as p', 'p.id', 'u.persona_id')
    .select([
      's.id as sesion_id',
      's.expira_en',
      'u.id as usuario_id',
      'u.login',
      'u.estado',
      'u.persona_id',
      'p.nombres',
      'p.apellidos',
    ])
    .where('s.token_hash', '=', tokenHash)
    .where('s.revocada_en', 'is', null)
    .where('s.expira_en', '>', sql<Date>`now()`)
    .executeTakeFirst();
}

export async function revocarSesion(sesionId: string) {
  await db().updateTable('sesiones').set({ revocada_en: sql`now()` }).where('id', '=', sesionId).where('revocada_en', 'is', null).execute();
}

export async function revocarSesionesDeUsuario(usuarioId: string, excepto?: string) {
  let q = db().updateTable('sesiones').set({ revocada_en: sql`now()` }).where('usuario_id', '=', usuarioId).where('revocada_en', 'is', null);
  if (excepto) q = q.where('id', '<>', excepto);
  await q.execute();
}

export async function registrarAcceso(usuarioId: string) {
  await db().updateTable('usuarios').set({ ultimo_acceso: sql`now()` }).where('id', '=', usuarioId).execute();
}

/** Roles y permisos efectivos (unión de los roles del usuario). */
export async function rolesYPermisos(usuarioId: string) {
  const roles = await db()
    .selectFrom('usuario_roles as ur')
    .innerJoin('roles as r', 'r.id', 'ur.rol_id')
    .select('r.codigo')
    .where('ur.usuario_id', '=', usuarioId)
    .execute();
  const permisos = await db()
    .selectFrom('usuario_roles as ur')
    .innerJoin('rol_permisos as rp', 'rp.rol_id', 'ur.rol_id')
    .innerJoin('permisos as p', 'p.id', 'rp.permiso_id')
    .select('p.codigo')
    .distinct()
    .where('ur.usuario_id', '=', usuarioId)
    .execute();
  return { roles: roles.map((r) => r.codigo), permisos: permisos.map((p) => p.codigo) };
}

/** Perfiles de la persona que habilitan portales por DATOS (no por nombre de rol). */
export async function perfilesDePersona(personaId: string) {
  const fila = await db()
    .selectNoFrom((eb) => [
      eb
        .exists(eb.selectFrom('docentes').select('id').where('persona_id', '=', personaId).where('activo', '=', true))
        .as('es_docente'),
      eb
        .exists(eb.selectFrom('estudiantes').select('id').where('persona_id', '=', personaId))
        .as('es_estudiante'),
      eb
        .exists(
          eb
            .selectFrom('estudiante_apoderado')
            .select('id')
            .where('persona_id', '=', personaId)
            .where(sql<boolean>`vigencia @> (now() at time zone 'America/Lima')::date`),
        )
        .as('es_apoderado'),
    ])
    .executeTakeFirstOrThrow();
  return {
    esDocente: Boolean(fila.es_docente),
    esEstudiante: Boolean(fila.es_estudiante),
    esApoderado: Boolean(fila.es_apoderado),
  };
}

export async function crearTokenAcceso(datos: {
  usuarioId: string;
  emisorId: string | null;
  proposito: 'activacion' | 'recuperacion';
  tokenHash: Buffer;
  expiraEn: Date;
}) {
  return db()
    .insertInto('tokens_acceso')
    .values({
      usuario_id: datos.usuarioId,
      emisor_id: datos.emisorId,
      proposito: datos.proposito,
      token_hash: datos.tokenHash,
      expira_en: datos.expiraEn,
    })
    .returning(['id', 'expira_en'])
    .executeTakeFirstOrThrow();
}

/** Token vigente (no consumido, no revocado, no vencido), bloqueado para consumo único. */
export async function buscarTokenVigenteParaConsumir(tokenHash: Buffer) {
  return db()
    .selectFrom('tokens_acceso as t')
    .innerJoin('usuarios as u', 'u.id', 't.usuario_id')
    .select(['t.id', 't.usuario_id', 't.proposito', 't.expira_en', 'u.estado', 'u.login'])
    .where('t.token_hash', '=', tokenHash)
    .where('t.consumido_en', 'is', null)
    .where('t.revocado_en', 'is', null)
    .where('t.expira_en', '>', sql<Date>`now()`)
    .forUpdate('t')
    .executeTakeFirst();
}

export async function consultarToken(tokenHash: Buffer) {
  return db()
    .selectFrom('tokens_acceso as t')
    .innerJoin('usuarios as u', 'u.id', 't.usuario_id')
    .innerJoin('personas as p', 'p.id', 'u.persona_id')
    .select(['t.proposito', 'u.login', 'p.nombres'])
    .where('t.token_hash', '=', tokenHash)
    .where('t.consumido_en', 'is', null)
    .where('t.revocado_en', 'is', null)
    .where('t.expira_en', '>', sql<Date>`now()`)
    .executeTakeFirst();
}

export async function consumirToken(tokenId: string) {
  await db().updateTable('tokens_acceso').set({ consumido_en: sql`now()` }).where('id', '=', tokenId).execute();
}

export async function revocarTokensDeUsuario(usuarioId: string) {
  await db()
    .updateTable('tokens_acceso')
    .set({ revocado_en: sql`now()` })
    .where('usuario_id', '=', usuarioId)
    .where('consumido_en', 'is', null)
    .where('revocado_en', 'is', null)
    .execute();
}

export async function actualizarContrasena(usuarioId: string, contrasenaHash: string, activar: boolean) {
  await db()
    .updateTable('usuarios')
    .set(activar ? { contrasena_hash: contrasenaHash, estado: 'activo' } : { contrasena_hash: contrasenaHash })
    .where('id', '=', usuarioId)
    .execute();
}

export async function obtenerHashContrasena(usuarioId: string) {
  const fila = await db().selectFrom('usuarios').select('contrasena_hash').where('id', '=', usuarioId).executeTakeFirst();
  return fila?.contrasena_hash ?? null;
}
