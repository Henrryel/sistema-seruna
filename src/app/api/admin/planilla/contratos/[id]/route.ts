import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaContrato } from '@/esquemas/planilla/contratos';
import * as servicio from '@/server/services/planilla/contratos';
import { leerCuerpoConArchivo } from '../../_comun/formulario';

export const GET = ruta({ permiso: 'planilla.contratos', parametros: parametrosId }, async ({ parametros }) =>
  servicio.obtenerContrato(parametros.id),
);

/** Edición dentro de lo que permita la base (con horas o liquidaciones: solo la vigencia). */
export const PUT = ruta(
  { permiso: 'planilla.contratos', parametros: parametrosId },
  async ({ req, actor, parametros }) => {
    const { datos, archivo } = await leerCuerpoConArchivo(req, esquemaContrato);
    return servicio.actualizarContrato(actor, parametros.id, datos, archivo);
  },
);
