import { ruta } from '@/server/http/ruta';
import { PERMISOS_REPORTES } from '@/esquemas/reportes/documentos';
import { plantillasDisponibles } from '@/server/services/reportes/documentos';

/** Plantillas publicadas de los tipos que el actor puede emitir. */
export const GET = ruta({ permiso: PERMISOS_REPORTES }, async ({ actor }) => ({ plantillas: await plantillasDisponibles(actor) }));
