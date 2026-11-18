import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/academico/planes';

export const POST = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ actor, parametros }) => servicio.publicar(actor, parametros.id));
