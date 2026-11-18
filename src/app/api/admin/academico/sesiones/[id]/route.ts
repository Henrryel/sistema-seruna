import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEstadoSesion } from '@/esquemas/academico/horarios';
import * as servicio from '@/server/services/academico/horarios';

/** Marca la sesión como realizada o cancelada (o reprograma una cancelada). */
export const PATCH = ruta({ permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaEstadoSesion }, async ({ actor, parametros, cuerpo }) =>
  servicio.cambiarEstadoSesion(actor, parametros.id, cuerpo.estado),
);
