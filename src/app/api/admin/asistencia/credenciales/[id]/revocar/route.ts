import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaRevocarCredencial } from '@/esquemas/asistencia/credenciales';
import * as servicio from '@/server/services/asistencia/credenciales';

export const POST = ruta(
  { permiso: 'asistencia.configurar', portal: 'admin', parametros: parametrosId, cuerpo: esquemaRevocarCredencial },
  async ({ actor, parametros, cuerpo }) => servicio.revocarCredencial(actor, parametros.id, cuerpo.motivo),
);
