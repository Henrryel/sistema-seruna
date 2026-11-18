import { ruta } from '@/server/http/ruta';
import { esquemaCambioContrasena } from '@/esquemas/auth';
import { cambiarContrasena } from '@/server/services/auth';

export const POST = ruta({ cuerpo: esquemaCambioContrasena }, async ({ actor, cuerpo }) => {
  await cambiarContrasena(actor, cuerpo.actual, cuerpo.nueva);
  return { ok: true };
});
