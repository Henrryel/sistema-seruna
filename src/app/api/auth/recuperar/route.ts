import { rutaPublica, ipCliente } from '@/server/http/ruta';
import { esquemaRecuperar } from '@/esquemas/auth';
import { solicitarRecuperacion } from '@/server/services/auth';

/** Registra la solicitud (sin revelar si el usuario existe). Secretaría emite el enlace de recuperación. */
export const POST = rutaPublica({ cuerpo: esquemaRecuperar }, async ({ req, cuerpo }) => {
  await solicitarRecuperacion(cuerpo.login, ipCliente(req));
  return { ok: true };
});
