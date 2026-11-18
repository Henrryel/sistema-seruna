import { descargar, ruta } from '@/server/http/ruta';
import { parametrosMatricula } from '@/esquemas/evaluacion/notas';
import * as servicio from '@/server/services/evaluacion/notas';

/** Libreta PDF de una matrícula (auditada). */
export const GET = ruta({ permiso: ['reportes.academico', 'academico.publicar'], parametros: parametrosMatricula }, async ({ actor, parametros }) => {
  const { pdf, boleta } = await servicio.libretaAdmin(actor, parametros.matriculaId);
  return descargar(pdf, `libreta-${boleta.matricula.anio}-${boleta.matricula.estudiante.codigo}.pdf`, 'application/pdf');
});
