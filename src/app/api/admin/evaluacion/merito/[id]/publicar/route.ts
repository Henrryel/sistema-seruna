import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/merito';

export const POST = ruta({ permiso: 'academico.publicar_merito', parametros: parametrosId }, async ({ actor, parametros }) => servicio.publicar(actor, parametros.id));
