import { ruta } from '@/server/http/ruta';
import { esquemaSincronizar } from '@/esquemas/asistencia/marcaciones';
import * as servicio from '@/server/services/asistencia/marcaciones';

/**
 * Lecturas QR capturadas SIN conexión (cola IndexedDB del escáner). Como en modo QR la hora la pone el
 * servidor, se registran en modo MANUAL con el instante capturado (máx. 7 días, nunca futuro) y el motivo
 * "Lectura QR sin conexión en lector <código>". La política de asistencia debe admitir manual.
 * Respuesta por evento: ok/definitivo para que el cliente sepa qué quitar de la cola.
 */
export const POST = ruta({ permiso: 'asistencia.marcar', cuerpo: esquemaSincronizar }, async ({ actor, cuerpo }) => servicio.sincronizar(actor, cuerpo.eventos));
