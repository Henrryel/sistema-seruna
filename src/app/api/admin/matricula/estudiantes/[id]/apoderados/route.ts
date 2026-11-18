import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaVinculo } from '@/esquemas/matricula/apoderados';
import * as servicio from '@/server/services/matricula/apoderados';

export const GET = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ parametros }) => ({
  apoderados: await servicio.listarApoderados(parametros.id),
}));

export const POST = ruta(
  { permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaVinculo },
  async ({ actor, parametros, cuerpo }) => servicio.vincularApoderado(actor, parametros.id, cuerpo),
);
