import { ruta } from '@/server/http/ruta';
import { esquemaMarcar } from '@/esquemas/asistencia/marcaciones';
import * as servicio from '@/server/services/asistencia/marcaciones';

/**
 * Marcación en línea desde el escáner (QR/Code 128). La base (`registrar_marcacion`) resuelve la persona
 * por el hash del token y pone la hora; NO verifica el permiso: se exige `asistencia.marcar` aquí.
 */
export const POST = ruta({ permiso: 'asistencia.marcar', cuerpo: esquemaMarcar }, async ({ actor, cuerpo }) => servicio.marcar(actor, cuerpo));
