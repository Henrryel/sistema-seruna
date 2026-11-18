import 'server-only';
import type { NextRequest } from 'next/server';
import type { z, ZodTypeAny } from 'zod';
import { ValidationError } from '@/server/errores';
import { archivoDeFormulario } from '@/server/almacenamiento';
import type { ArchivoSubido } from '@/server/services/matricula/comun';

/**
 * Lee un multipart/form-data: valida los campos de texto con el esquema Zod y extrae el archivo
 * (campo `archivo` por defecto). La CSRF/sesión/permiso ya las verificó `ruta()`.
 */
export async function leerFormulario<T extends ZodTypeAny>(
  req: NextRequest,
  esquema: T,
  opciones: { archivo: 'requerido'; campo?: string },
): Promise<{ datos: z.infer<T>; archivo: ArchivoSubido }>;
export async function leerFormulario<T extends ZodTypeAny>(
  req: NextRequest,
  esquema: T,
  opciones: { archivo: 'opcional'; campo?: string },
): Promise<{ datos: z.infer<T>; archivo: ArchivoSubido | null }>;
export async function leerFormulario<T extends ZodTypeAny>(
  req: NextRequest,
  esquema: T,
  opciones: { archivo: 'requerido' | 'opcional'; campo?: string },
): Promise<{ datos: z.infer<T>; archivo: ArchivoSubido | null }> {
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
  const campo = opciones.campo ?? 'archivo';
  const valor = form.get(campo);
  const hay = typeof valor === 'object' && valor !== null && 'size' in valor && valor.size > 0;
  if (!hay && opciones.archivo === 'requerido') throw new ValidationError('Adjunte un archivo');
  return { datos: r.data as z.infer<T>, archivo: hay ? await archivoDeFormulario(form, campo) : null };
}
