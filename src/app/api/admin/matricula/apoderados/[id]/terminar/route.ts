import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaTerminarVinculo } from '@/esquemas/matricula/apoderados';
import * as servicio from '@/server/services/matricula/apoderados';

export const POST = ruta(
  { permiso: 'matriculas.gestionar', parametros: parametrosId, cuerpo: esquemaTerminarVinculo },
  async ({ actor, parametros, cuerpo }) => servicio.terminarVinculo(actor, parametros.id, cuerpo.fin),
);
