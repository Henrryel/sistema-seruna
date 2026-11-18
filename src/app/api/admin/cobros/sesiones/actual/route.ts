import { ruta } from '@/server/http/ruta';
import * as servicio from '@/server/services/cobros/caja';

/** Sesión abierta del operador actual con su arqueo en curso. */
export const GET = ruta({ permiso: 'tesoreria.cobrar' }, async ({ actor }) => servicio.sesionActual(actor));
