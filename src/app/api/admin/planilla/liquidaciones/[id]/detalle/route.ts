import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaLinea } from '@/esquemas/planilla/liquidaciones';
import * as servicio from '@/server/services/planilla/liquidaciones';

/** Agrega un adicional o descuento (solo en borrador: lo exige la base). */
export const POST = ruta(
  { permiso: 'planilla.liquidar', parametros: parametrosId, cuerpo: esquemaLinea },
  async ({ actor, parametros, cuerpo }) => servicio.agregarLinea(actor, parametros.id, cuerpo),
);
