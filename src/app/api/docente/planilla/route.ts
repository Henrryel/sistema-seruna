import { ruta } from '@/server/http/ruta';
import * as servicio from '@/server/services/planilla/portal-docente';

/** Planilla propia del docente: contratos y liquidaciones aprobadas con saldos. */
export const GET = ruta({ portal: 'docente' }, async ({ actor }) => servicio.resumen(actor));
