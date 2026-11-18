import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/siagie';

export const GET = ruta({ permiso: 'academico.exportar_siagie', parametros: parametrosId }, async ({ parametros }) => servicio.detallePlantilla(parametros.id));
