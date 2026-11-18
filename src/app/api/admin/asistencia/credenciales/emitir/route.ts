import { descargar, ruta } from '@/server/http/ruta';
import { esquemaEmitirCredenciales } from '@/esquemas/asistencia/credenciales';
import * as servicio from '@/server/services/asistencia/credenciales';

/**
 * Emite (o reemite) credenciales y devuelve el PDF de carnets. El token solo viaja dentro del PDF:
 * no se devuelve en JSON ni se guarda (la base tiene solo su hash).
 */
export const POST = ruta({ permiso: 'asistencia.configurar', portal: 'admin', cuerpo: esquemaEmitirCredenciales }, async ({ actor, cuerpo }) => {
  const { pdf, emitidas, revocadas } = await servicio.emitirCredenciales(actor, cuerpo);
  const respuesta = descargar(pdf, `carnets-${new Date().toISOString().slice(0, 10)}.pdf`, 'application/pdf');
  respuesta.headers.set('X-Credenciales-Emitidas', String(emitidas.length));
  respuesta.headers.set('X-Credenciales-Revocadas', String(revocadas));
  return respuesta;
});
