import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaPersona } from '@/esquemas/identidad/personas';
import * as servicio from '@/server/services/identidad/personas';

const PERMISO = ['usuarios.gestionar', 'matriculas.gestionar'] as const;

export const GET = ruta({ permiso: PERMISO, parametros: parametrosId }, async ({ parametros }) => servicio.obtenerPersona(parametros.id));

export const PUT = ruta({ permiso: PERMISO, parametros: parametrosId, cuerpo: esquemaPersona }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarPersona(actor, parametros.id, cuerpo),
);
