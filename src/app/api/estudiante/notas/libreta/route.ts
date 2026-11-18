import { descargar, ruta } from '@/server/http/ruta';
import { consultaLibretaEstudiante } from '@/esquemas/evaluacion/notas';
import * as servicio from '@/server/services/evaluacion/notas';

export const GET = ruta({ portal: 'estudiante', consulta: consultaLibretaEstudiante }, async ({ actor, consulta }) =>
  descargar(await servicio.libretaEstudiante(actor, consulta.matriculaId), `libreta-${consulta.matriculaId}.pdf`, 'application/pdf'),
);
