import { ruta } from '@/server/http/ruta';
import { esquemaGenerarJornadas } from '@/esquemas/asistencia/configuracion';
import * as servicio from '@/server/services/asistencia/configuracion';

export const POST = ruta({ permiso: 'asistencia.configurar', portal: 'admin', cuerpo: esquemaGenerarJornadas }, async ({ actor, cuerpo }) =>
  servicio.generarJornadas(actor, cuerpo),
);
