import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaPolitica } from '@/esquemas/asistencia/configuracion';
import * as servicio from '@/server/services/asistencia/configuracion';

export const PUT = ruta(
  { permiso: 'asistencia.configurar', portal: 'admin', parametros: parametrosId, cuerpo: esquemaPolitica },
  async ({ actor, parametros, cuerpo }) => servicio.actualizarPolitica(actor, parametros.id, cuerpo),
);
