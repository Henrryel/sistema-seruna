import 'server-only';
import type { NextRequest } from 'next/server';
import type { z, ZodTypeAny } from 'zod';
import { ValidationError } from '@/server/errores';

/**
 * Lee un multipart/form-data: valida los campos de texto con el esquema Zod y devuelve el adjunto
 * opcional del campo `archivo` (la validación de tipo/tamaño la hace `guardarArchivo`).
 */
export async function leerFormulario<T extends ZodTypeAny>(req: NextRequest, esquema: T) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ValidationError('Envíe los datos como formulario (multipart/form-data)');
  }
  const campos: Record<string, string> = {};
  for (const [clave, valor] of form.entries()) if (typeof valor === 'string') campos[clave] = valor;
  const r = esquema.safeParse(campos);
  if (!r.success) {
    const primero = r.error.issues[0];
    throw new ValidationError(primero ? `${primero.path.join('.') || 'formulario'}: ${primero.message}` : 'Datos inválidos', {
      campos: r.error.flatten().fieldErrors,
    });
  }
  const archivo = form.get('archivo');
  const adjunto =
    archivo instanceof File && archivo.size > 0
      ? { contenido: Buffer.from(await archivo.arrayBuffer()), nombreOriginal: archivo.name || 'archivo', tipoMime: archivo.type || 'application/octet-stream' }
      : null;
  return { datos: r.data as z.infer<T>, adjunto };
}
