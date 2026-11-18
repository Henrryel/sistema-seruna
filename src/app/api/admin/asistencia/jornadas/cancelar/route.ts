import { ruta } from '@/server/http/ruta';
import { esquemaCancelarJornada } from '@/esquemas/asistencia/configuracion';
import * as servicio from '@/server/services/asistencia/configuracion';

export const POST = ruta({ permiso: 'asistencia.configurar', portal: 'admin', cuerpo: esquemaCancelarJornada }, async ({ actor, cuerpo }) =>
  servicio.cancelarJornada(actor, cuerpo.tipo, cuerpo.id, cuerpo.motivo),
);
