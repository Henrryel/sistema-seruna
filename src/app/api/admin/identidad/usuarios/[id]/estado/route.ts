import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEstadoUsuario } from '@/esquemas/identidad/usuarios';
import * as servicio from '@/server/services/identidad/usuarios';

export const POST = ruta({ permiso: 'usuarios.gestionar', parametros: parametrosId, cuerpo: esquemaEstadoUsuario }, async ({ actor, parametros, cuerpo }) =>
  servicio.cambiarEstado(actor, parametros.id, cuerpo),
);
