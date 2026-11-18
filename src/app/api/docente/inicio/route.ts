import { ruta } from '@/server/http/ruta';
import { inicioDocente } from '@/server/services/dashboard/inicio';

/** Clases del día y calificaciones pendientes del docente autenticado (solo sus asignaciones). */
export const GET = ruta({ portal: 'docente' }, async ({ actor }) => inicioDocente(actor));
