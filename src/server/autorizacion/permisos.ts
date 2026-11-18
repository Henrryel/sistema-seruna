import { ForbiddenError } from '@/server/errores';
import type { Actor } from '@/server/auth/actor';
import { PERMISOS, type Permiso } from '@/lib/permisos';

export { PERMISOS, type Permiso };

export function tienePermiso(actor: Pick<Actor, 'permisos'>, permiso: Permiso | readonly Permiso[]): boolean {
  const lista = typeof permiso === 'string' ? [permiso] : permiso;
  return lista.some((p) => actor.permisos.includes(p));
}

/** Exige al menos uno de los permisos indicados (autorización por PERMISO, nunca por nombre de rol). */
export function exigirPermiso(actor: Pick<Actor, 'permisos'>, permiso: Permiso | readonly Permiso[]): void {
  if (!tienePermiso(actor, permiso)) throw new ForbiddenError();
}
