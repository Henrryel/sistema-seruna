import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/identidad/usuarios';

/** Cierra todas las sesiones abiertas del usuario. */
export const DELETE = ruta({ permiso: 'usuarios.gestionar', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.revocarSesiones(actor, parametros.id),
);
