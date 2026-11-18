import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaRolesUsuario } from '@/esquemas/identidad/usuarios';
import * as servicio from '@/server/services/identidad/usuarios';

export const PUT = ruta({ permiso: 'usuarios.gestionar', parametros: parametrosId, cuerpo: esquemaRolesUsuario }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarRoles(actor, parametros.id, cuerpo.roles),
);
