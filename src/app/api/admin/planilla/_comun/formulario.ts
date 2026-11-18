import 'server-only';
import type { NextRequest } from 'next/server';
import type { z, ZodTypeAny } from 'zod';
import { ValidationError } from '@/server/errores';
import type { ArchivoSubido } from '@/server/services/planilla/archivos';

/**
 * Lee un cuerpo JSON o multipart/form-data (campo `datos` con JSON + campo `archivo` opcional) y lo valida
 * con Zod. Así el adjunto (documento del contrato, evidencias) se guarda en LA MISMA transacción que el
 * registro, que en planilla es inmutable y no se puede completar después.
 */
export async function leerCuerpoConArchivo<T extends ZodTypeAny>(
  req: NextRequest,
  esquema: T,
): Promise<{ datos: z.infer<T>; archivo: ArchivoSubido | null }> {
  const tipo = req.headers.get('content-type') ?? '';
  let crudo: unknown = {};
  let archivo: ArchivoSubido | null = null;
  try {
    if (tipo.includes('multipart/form-data')) {
      const form = await req.formData();
      const datos = form.get('datos');
      crudo = typeof datos === 'string' && datos ? JSON.parse(datos) : {};
      const valor = form.get('archivo');
      if (valor instanceof File && valor.size > 0) {
        archivo = {
          contenido: Buffer.from(await valor.arrayBuffer()),
          nombreOriginal: valor.name || 'archivo',
          tipoMime: valor.type || 'application/octet-stream',
        };
      }
    } else {
      const texto = await req.text();
      crudo = texto ? JSON.parse(texto) : {};
    }
  } catch {
    throw new ValidationError('El cuerpo de la solicitud no es válido');
  }
  const r = esquema.safeParse(crudo);
  if (!r.success) {
    const primero = r.error.issues[0];
    throw new ValidationError(
      primero ? `${primero.path.join('.') || 'cuerpo'}: ${primero.message}` : 'Datos inválidos',
      {
        campos: r.error.flatten().fieldErrors,
      },
    );
  }
  return { datos: r.data, archivo };
}
