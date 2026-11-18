import { ruta } from '@/server/http/ruta';
import * as servicio from '@/server/services/identidad/usuarios';

export const GET = ruta({ permiso: 'usuarios.gestionar' }, async () => ({ roles: await servicio.listarRoles() }));
