import 'server-only';
import type { NextRequest } from 'next/server';
import type { z, ZodTypeAny } from 'zod';
import { ValidationError } from '@/server/errores';

// Utilidades para Route Handlers con multipart/form-data (archivos opcionales): `ruta()` solo lee JSON,
// así que estos endpoints leen el FormData y validan con el MISMO esquema Zod del cliente.

export interface ArchivoSubido {
  contenido: Buffer;
  nombreOriginal: string;
  tipoMime: string;
}

export async function leerFormulario(req: NextRequest): Promise<FormData> {
  const tipo = req.headers.get('content-type') ?? '';
  if (!tipo.includes('multipart/form-data')) throw new ValidationError('Envíe el formulario como multipart/form-data');
  try {
    return await req.formData();
  } catch {
    throw new ValidationError('No se pudo leer el formulario enviado');
  }
}

export function validarDatos<T extends ZodTypeAny>(esquema: T, datos: unknown): z.infer<T> {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    const primero = r.error.issues[0];
    throw new ValidationError(primero ? `${primero.path.join('.') || 'formulario'}: ${primero.message}` : 'Datos inválidos', {
      campos: r.error.flatten().fieldErrors,
    });
  }
  return r.data;
}

/** Campos de texto del formulario (ignora archivos). */
export function camposTexto(form: FormData): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') r[k] = v;
  return r;
}

/** Campo JSON del formulario (p. ej. listas o mapas). */
export function campoJson(form: FormData, campo: string): unknown {
  const v = form.get(campo);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    throw new ValidationError(`${campo}: JSON inválido`);
  }
}

async function aArchivo(valor: File): Promise<ArchivoSubido> {
  return {
    contenido: Buffer.from(await valor.arrayBuffer()),
    nombreOriginal: valor.name || 'archivo',
    tipoMime: valor.type || 'application/octet-stream',
  };
}

export async function archivoOpcional(form: FormData, campo = 'archivo'): Promise<ArchivoSubido | null> {
  const valor = form.get(campo);
  if (!(valor instanceof File) || valor.size === 0) return null;
  return aArchivo(valor);
}

export async function archivosDe(form: FormData, campo = 'archivos'): Promise<ArchivoSubido[]> {
  const lista = form.getAll(campo).filter((v): v is File => v instanceof File && v.size > 0);
  return Promise.all(lista.map(aArchivo));
}
