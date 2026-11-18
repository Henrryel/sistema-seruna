import { ruta } from '@/server/http/ruta';
import { consultaCondiciones } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

/** Condiciones económicas publicadas del año (documentos institucionales). */
export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaCondiciones }, async ({ consulta }) => ({
  condiciones: await servicio.condicionesPublicadas(consulta.anioId),
}));
