import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { descargarEvidencia } from '@/server/asistencia/http';

export const GET = ruta({ portal: 'estudiante', parametros: parametrosId }, async ({ actor, parametros }) => descargarEvidencia(actor, parametros.id));
