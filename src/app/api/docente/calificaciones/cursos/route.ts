import { ruta } from '@/server/http/ruta';
import * as servicio from '@/server/services/evaluacion/calificaciones';

export const GET = ruta({ portal: 'docente', permiso: 'academico.calificar' }, async ({ actor }) => ({ cursos: await servicio.cursosDocente(actor) }));
