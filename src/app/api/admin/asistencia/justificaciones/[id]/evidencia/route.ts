import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { descargarEvidencia } from '@/server/asistencia/http';

export const GET = ruta({ permiso: 'asistencia.resolver', portal: 'admin', parametros: parametrosId }, async ({ actor, parametros }) =>
  descargarEvidencia(actor, parametros.id),
);
