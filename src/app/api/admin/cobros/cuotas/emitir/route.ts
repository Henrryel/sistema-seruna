import { ruta } from '@/server/http/ruta';
import { esquemaEmision } from '@/esquemas/cobros/cuotas';
import * as servicio from '@/server/services/cobros/cuotas';

/** Emisión por matrícula, sección o grado replicando los tramos del plan publicado. */
export const POST = ruta({ permiso: 'tesoreria.cobrar', cuerpo: esquemaEmision }, async ({ actor, cuerpo }) => servicio.emitirCuotas(actor, cuerpo));
