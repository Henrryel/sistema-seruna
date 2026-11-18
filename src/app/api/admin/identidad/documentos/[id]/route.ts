import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaDocumento } from '@/esquemas/identidad/personas';
import * as servicio from '@/server/services/identidad/personas';

const PERMISO = ['usuarios.gestionar', 'matriculas.gestionar'] as const;

export const PUT = ruta({ permiso: PERMISO, parametros: parametrosId, cuerpo: esquemaDocumento }, async ({ actor, parametros, cuerpo }) =>
  servicio.actualizarDocumento(actor, parametros.id, cuerpo),
);

export const DELETE = ruta({ permiso: PERMISO, parametros: parametrosId }, async ({ actor, parametros }) => servicio.eliminarDocumento(actor, parametros.id));
