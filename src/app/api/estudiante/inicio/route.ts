import { ruta } from '@/server/http/ruta';
import { inicioEstudiante } from '@/server/services/dashboard/inicio';

/** Resumen del propio estudiante: últimos logros, asistencia del mes y deuda. */
export const GET = ruta({ portal: 'estudiante' }, async ({ actor }) => inicioEstudiante(actor));
