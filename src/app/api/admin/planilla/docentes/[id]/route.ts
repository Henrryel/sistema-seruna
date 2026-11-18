import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaActualizarDocente } from '@/esquemas/planilla/contratos';
import * as servicio from '@/server/services/planilla/contratos';

export const PUT = ruta(
  { permiso: 'planilla.contratos', parametros: parametrosId, cuerpo: esquemaActualizarDocente },
  async ({ actor, parametros, cuerpo }) => servicio.actualizarDocente(actor, parametros.id, cuerpo),
);
