import { ruta } from '@/server/http/ruta';

/** Datos del usuario autenticado (sin información sensible). */
export const GET = ruta({}, async ({ actor }) => ({
  usuarioId: actor.usuarioId,
  login: actor.login,
  nombres: actor.nombres,
  apellidos: actor.apellidos,
  roles: actor.roles,
  permisos: actor.permisos,
  portales: actor.portales,
}));
