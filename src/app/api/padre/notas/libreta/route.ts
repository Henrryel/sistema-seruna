import { descargar, ruta } from '@/server/http/ruta';
import { consultaLibretaPadre } from '@/esquemas/evaluacion/notas';
import * as servicio from '@/server/services/evaluacion/notas';

export const GET = ruta({ portal: 'padre', consulta: consultaLibretaPadre }, async ({ actor, consulta }) =>
  descargar(await servicio.libretaHijo(actor, consulta.estudianteId, consulta.matriculaId), `libreta-${consulta.matriculaId}.pdf`, 'application/pdf'),
);
