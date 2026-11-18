import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaDocumento } from '@/esquemas/identidad/personas';
import * as servicio from '@/server/services/identidad/personas';

export const POST = ruta(
  { permiso: ['usuarios.gestionar', 'matriculas.gestionar'], parametros: parametrosId, cuerpo: esquemaDocumento },
  async ({ actor, parametros, cuerpo }) => servicio.agregarDocumento(actor, parametros.id, cuerpo),
);
