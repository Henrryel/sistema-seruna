import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaResolverJustificacion } from '@/esquemas/asistencia/justificaciones';
import * as servicio from '@/server/services/asistencia/justificaciones';

export const POST = ruta(
  { permiso: 'asistencia.resolver', portal: 'admin', parametros: parametrosId, cuerpo: esquemaResolverJustificacion },
  async ({ actor, parametros, cuerpo }) => servicio.resolver(actor, parametros.id, cuerpo),
);
