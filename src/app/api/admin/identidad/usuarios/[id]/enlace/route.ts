import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaEnlaceAcceso } from '@/esquemas/identidad/usuarios';
import * as servicio from '@/server/services/identidad/usuarios';

/** Enlace de activación/recuperación de un solo uso. La URL se muestra UNA vez (solo se guarda el hash). */
export const POST = ruta({ permiso: 'usuarios.gestionar', parametros: parametrosId, cuerpo: esquemaEnlaceAcceso }, async ({ req, actor, parametros, cuerpo }) =>
  servicio.generarEnlace(actor, parametros.id, cuerpo, req.nextUrl.origin),
);
