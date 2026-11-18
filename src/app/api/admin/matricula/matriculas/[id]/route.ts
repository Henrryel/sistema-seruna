import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import * as servicio from '@/server/services/matricula/matriculas';

export const GET = ruta({ permiso: 'matriculas.gestionar', parametros: parametrosId }, async ({ parametros }) => servicio.detalleMatricula(parametros.id));
