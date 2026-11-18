import { ruta } from '@/server/http/ruta';
import { PERMISOS_COMUNICACIONES } from '@/esquemas/reportes/documentos';
import { consultaPersonas } from '@/esquemas/reportes/comunicaciones';
import { buscarPersonas } from '@/server/services/reportes/comunicaciones';

/** Búsqueda de destinatarios (nombres, apellidos o número de documento; máximo 20). */
export const GET = ruta({ permiso: PERMISOS_COMUNICACIONES, consulta: consultaPersonas }, async ({ consulta }) => ({
  opciones: await buscarPersonas(consulta.q),
}));
