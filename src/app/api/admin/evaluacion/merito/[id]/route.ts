import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/evaluacion/merito';

export const GET = ruta({ permiso: 'academico.publicar_merito', parametros: parametrosId }, async ({ parametros }) => servicio.detallePublicacion(parametros.id));

/** Elimina una publicación aún no publicada (la base conserva las publicadas). */
export const DELETE = ruta({ permiso: 'academico.publicar_merito', parametros: parametrosId }, async ({ actor, parametros }) =>
  servicio.eliminarPublicacion(actor, parametros.id),
);
