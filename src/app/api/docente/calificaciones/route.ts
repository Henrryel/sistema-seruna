import { ruta } from '@/server/http/ruta';
import { consultaGrillaDocente, esquemaGuardarDocente } from '@/esquemas/evaluacion/calificaciones';
import * as servicio from '@/server/services/evaluacion/calificaciones';

// Docente: solo cursos asignados (alcance en el servicio) y solo las competencias de su asignatura.

export const GET = ruta({ portal: 'docente', permiso: 'academico.calificar', consulta: consultaGrillaDocente }, async ({ actor, consulta }) =>
  servicio.grillaDocente(actor, consulta),
);

export const POST = ruta({ portal: 'docente', permiso: 'academico.calificar', cuerpo: esquemaGuardarDocente }, async ({ actor, cuerpo }) =>
  servicio.guardarDocente(actor, cuerpo),
);
