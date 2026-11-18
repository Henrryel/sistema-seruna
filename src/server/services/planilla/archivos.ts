import 'server-only';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import { ForbiddenError, NotFoundError } from '@/server/errores';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { usosDeArchivo } from '@/server/repositories/planilla/contratos';
import type { Actor } from '@/server/auth/actor';
import { PERMISOS_VER_HORAS, PERMISOS_VER_LIQUIDACIONES } from '@/esquemas/planilla/permisos';

/** Archivo adjunto recibido en un multipart (documento de contrato, evidencias). */
export interface ArchivoSubido {
  contenido: Buffer;
  nombreOriginal: string;
  tipoMime: string;
}

/** Guarda el adjunto (si lo hay) dentro de la transacción en curso y devuelve su id. */
export async function guardarAdjunto(archivo: ArchivoSubido | null | undefined): Promise<string | null> {
  if (!archivo) return null;
  const r = await guardarArchivo(archivo);
  return r.id;
}

/**
 * Lee un archivo SOLO si pertenece a un registro de planilla y el actor tiene el permiso de ese registro:
 * documento de contrato → planilla.contratos; evidencia de horas → ver horas; pagos/reversiones → ver liquidaciones.
 */
export async function leerArchivoPlanilla(actor: Pick<Actor, 'permisos'>, archivoId: string) {
  const usos = await usosDeArchivo(archivoId);
  if (!usos.contrato && !usos.hora && !usos.pago) throw new NotFoundError('El archivo no existe');
  const permitido =
    (usos.contrato && tienePermiso(actor, 'planilla.contratos')) ||
    (usos.hora && tienePermiso(actor, PERMISOS_VER_HORAS)) ||
    (usos.pago && tienePermiso(actor, PERMISOS_VER_LIQUIDACIONES));
  if (!permitido) throw new ForbiddenError();
  return leerArchivo(archivoId);
}
