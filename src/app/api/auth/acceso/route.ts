import { rutaPublica } from '@/server/http/ruta';
import { esquemaCanjeToken } from '@/esquemas/auth';
import { canjearTokenAcceso } from '@/server/services/auth';

/** Activación de cuenta o recuperación: canjea el token de un solo uso y fija la contraseña. */
export const POST = rutaPublica({ cuerpo: esquemaCanjeToken }, async ({ cuerpo }) => {
  const r = await canjearTokenAcceso(cuerpo.token, cuerpo.contrasena);
  return { ok: true, login: r.login };
});
