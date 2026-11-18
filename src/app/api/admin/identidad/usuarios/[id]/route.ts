import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/identidad/usuarios';

export const GET = ruta({ permiso: 'usuarios.gestionar', parametros: parametrosId }, async ({ parametros }) => servicio.obtenerUsuario(parametros.id));
