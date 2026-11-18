import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { UnauthorizedError } from '@/server/errores';
import { hashToken } from './tokens';
import { COOKIE_SESION } from './cookies';
import * as repo from '@/server/repositories/identidad/auth';
import { PERMISOS, PERMISOS_ADMINISTRATIVOS, type Permiso, type Portal } from '@/lib/permisos';

/** Usuario autenticado en la petición actual. */
export interface Actor {
  usuarioId: string;
  personaId: string;
  login: string;
  nombres: string;
  apellidos: string;
  roles: string[];
  permisos: Permiso[];
  portales: Portal[];
  sesionId: string;
}

const esPermiso = (p: string): p is Permiso => (PERMISOS as readonly string[]).includes(p);

/** Construye el actor a partir del usuario (se usa también en pruebas). */
export async function construirActor(datos: {
  usuarioId: string;
  personaId: string;
  login: string;
  nombres: string;
  apellidos: string;
  sesionId: string;
}): Promise<Actor> {
  const [{ roles, permisos }, perfiles] = await Promise.all([
    repo.rolesYPermisos(datos.usuarioId),
    repo.perfilesDePersona(datos.personaId),
  ]);
  const lista = permisos.filter(esPermiso);
  const portales: Portal[] = [];
  if (lista.some((p) => PERMISOS_ADMINISTRATIVOS.includes(p))) portales.push('admin');
  if (perfiles.esDocente) portales.push('docente');
  if (perfiles.esEstudiante) portales.push('estudiante');
  if (perfiles.esApoderado) portales.push('padre');
  return { ...datos, roles, permisos: lista, portales };
}

/** Lee y valida la cookie de sesión. Cacheado por petición. */
export const obtenerActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token || token.length > 100) return null;
  const sesion = await repo.obtenerSesionVigente(hashToken(token));
  if (!sesion || sesion.estado !== 'activo') return null;
  return construirActor({
    usuarioId: sesion.usuario_id,
    personaId: sesion.persona_id,
    login: sesion.login,
    nombres: sesion.nombres,
    apellidos: sesion.apellidos,
    sesionId: sesion.sesion_id,
  });
});

export async function exigirActor(): Promise<Actor> {
  const actor = await obtenerActor();
  if (!actor) throw new UnauthorizedError();
  return actor;
}
