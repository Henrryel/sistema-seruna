import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { consultaQuitarMapeo, esquemaMapeo } from '@/esquemas/evaluacion/siagie';
import * as servicio from '@/server/services/evaluacion/siagie';

export const POST = ruta({ permiso: 'academico.exportar_siagie', parametros: parametrosId, cuerpo: esquemaMapeo }, async ({ actor, parametros, cuerpo }) =>
  servicio.agregarMapeo(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: 'academico.exportar_siagie', parametros: parametrosId, consulta: consultaQuitarMapeo }, async ({ actor, parametros, consulta }) =>
  servicio.quitarMapeo(actor, parametros.id, consulta.mapeoId),
);
