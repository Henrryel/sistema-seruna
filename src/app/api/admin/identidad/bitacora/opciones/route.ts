import { ruta } from '@/server/http/ruta';
import * as servicio from '@/server/services/identidad/bitacora';

export const GET = ruta({ permiso: 'usuarios.gestionar' }, async () => servicio.opcionesBitacora());
