import { ruta } from '@/server/http/ruta';
import { consultaChecklist } from '@/esquemas/matricula/expedientes';
import * as servicio from '@/server/services/matricula/expedientes';

/** Requisitos de la regla de la matrícula vs. documentos presentados. */
export const GET = ruta({ permiso: ['expediente.gestionar', 'matriculas.gestionar'], consulta: consultaChecklist }, async ({ consulta }) =>
  servicio.checklistMatricula(consulta.matriculaId),
);
