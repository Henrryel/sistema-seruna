import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/caja';

/** Sesión con su arqueo (esperado = inicial + efectivo − devoluciones en efectivo). */
export const GET = ruta({ permiso: 'tesoreria.cobrar', parametros: parametrosId }, async ({ parametros }) => servicio.arqueo(parametros.id));
