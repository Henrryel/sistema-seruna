import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/reglas';

export const POST = ruta({ permiso: 'academico.configurar_cierre_anual', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.aprobarRegla(actor, parametros.id),
);
