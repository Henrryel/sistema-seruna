import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { obtenerActor, type Actor } from '@/server/auth/actor';
import { COOKIE_HIJO, COOKIE_PORTAL } from '@/server/auth/cookies';
import { tienePermiso, type Permiso } from '@/server/autorizacion/permisos';
import { hijosDelApoderado } from '@/server/autorizacion/alcance';
import type { Portal } from '@/lib/permisos';

// Utilidades para Server Components (páginas y layouts). Las APIs usan `ruta()`.

export async function exigirSesionPagina(): Promise<Actor> {
  const actor = await obtenerActor();
  if (!actor) redirect('/login');
  return actor;
}

export async function exigirPortalPagina(portal: Portal): Promise<Actor> {
  const actor = await exigirSesionPagina();
  if (!actor.portales.includes(portal)) redirect('/portal');
  return actor;
}

/** Para páginas administrativas: exige alguno de los permisos o muestra 403 vía redirect. */
export async function exigirPermisoPagina(permiso: Permiso | readonly Permiso[]): Promise<Actor> {
  const actor = await exigirPortalPagina('admin');
  if (!tienePermiso(actor, permiso)) redirect('/admin?sinPermiso=1');
  return actor;
}

export async function portalPreferido(actor: Actor): Promise<Portal | null> {
  const guardado = (await cookies()).get(COOKIE_PORTAL)?.value as Portal | undefined;
  if (guardado && actor.portales.includes(guardado)) return guardado;
  return actor.portales.length === 1 ? (actor.portales[0] ?? null) : null;
}

/** Hijo seleccionado en el portal de padres (cookie validada contra el vínculo vigente). */
export async function hijoSeleccionado(actor: Actor) {
  const hijos = await hijosDelApoderado(actor);
  const guardado = (await cookies()).get(COOKIE_HIJO)?.value;
  const hijo = hijos.find((h) => h.estudianteId === guardado) ?? hijos[0] ?? null;
  return { hijos, hijo };
}
