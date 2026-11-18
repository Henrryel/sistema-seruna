import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaCompetenciaPlan } from '@/esquemas/academico/planes';
import * as servicio from '@/server/services/academico/planes';

export const POST = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaCompetenciaPlan }, async ({ actor, parametros, cuerpo }) =>
  servicio.agregarCompetencia(actor, parametros.id, cuerpo.competenciaId),
);

/** DELETE ?competenciaId=… */
export const DELETE = ruta({ permiso: 'academico.configurar', parametros: parametrosId, consulta: esquemaCompetenciaPlan }, async ({ actor, parametros, consulta }) =>
  servicio.quitarCompetencia(actor, parametros.id, consulta.competenciaId),
);
