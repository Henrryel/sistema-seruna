import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaLector } from '@/esquemas/asistencia/configuracion';
import * as servicio from '@/server/services/asistencia/configuracion';

const op = { permiso: 'asistencia.configurar', portal: 'admin', parametros: parametrosId } as const;

export const PUT = ruta({ ...op, cuerpo: esquemaLector }, async ({ actor, parametros, cuerpo }) => servicio.actualizarLector(actor, parametros.id, cuerpo));

/** Solo lectores sin marcaciones; los usados se desactivan (la base conserva el historial). */
export const DELETE = ruta(op, async ({ actor, parametros }) => servicio.eliminarLector(actor, parametros.id));
