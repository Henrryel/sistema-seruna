import { descargar, ruta } from '@/server/http/ruta';
import { consultaLibretaSeccion } from '@/esquemas/evaluacion/notas';
import * as servicio from '@/server/services/evaluacion/notas';

/** Libretas de todas las matrículas de la sección en un solo PDF (auditado). */
export const GET = ruta({ permiso: ['reportes.academico', 'academico.publicar'], consulta: consultaLibretaSeccion }, async ({ actor, consulta }) =>
  descargar(await servicio.libretasSeccion(actor, consulta.seccionId), `libretas-seccion-${consulta.seccionId}.pdf`, 'application/pdf'),
);
