import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { db } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';

// Archivos fuera de la base: la tabla `archivos` guarda clave (ruta relativa), MIME, bytes y SHA-256.
const RAIZ = resolve(process.env.STORAGE_DIR ?? './storage');
export const MAX_BYTES = 15 * 1024 * 1024;

export const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/json',
]);

function rutaSegura(clave: string): string {
  const ruta = resolve(RAIZ, clave);
  if (!ruta.startsWith(RAIZ + sep)) throw new ValidationError('Clave de almacenamiento inválida');
  return ruta;
}

/** Guarda el contenido y registra la fila en `archivos` (dentro de la transacción en curso, si la hay). */
export async function guardarArchivo(entrada: { contenido: Buffer; nombreOriginal: string; tipoMime: string }) {
  if (entrada.contenido.length > MAX_BYTES) throw new ValidationError('El archivo supera el tamaño máximo (15 MB)');
  if (!MIME_PERMITIDOS.has(entrada.tipoMime)) throw new ValidationError(`Tipo de archivo no permitido: ${entrada.tipoMime}`);
  const ahora = new Date();
  const ext = extname(entrada.nombreOriginal).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
  const clave = `${ahora.getUTCFullYear()}/${String(ahora.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}${ext}`;
  const ruta = rutaSegura(clave);
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, entrada.contenido);
  const sha256 = createHash('sha256').update(entrada.contenido).digest();
  return db()
    .insertInto('archivos')
    .values({
      clave_almacenamiento: clave,
      nombre_original: entrada.nombreOriginal.slice(0, 255),
      tipo_mime: entrada.tipoMime,
      bytes: entrada.contenido.length,
      sha256,
    })
    .returning(['id', 'clave_almacenamiento', 'nombre_original', 'tipo_mime', 'bytes'])
    .executeTakeFirstOrThrow();
}

/** Lee un archivo registrado. La AUTORIZACIÓN la hace el servicio que lo expone. */
export async function leerArchivo(archivoId: string) {
  const meta = await db()
    .selectFrom('archivos')
    .select(['id', 'clave_almacenamiento', 'nombre_original', 'tipo_mime', 'bytes', 'sha256'])
    .where('id', '=', archivoId)
    .executeTakeFirst();
  if (!meta) throw new NotFoundError('El archivo no existe');
  try {
    const contenido = await readFile(rutaSegura(meta.clave_almacenamiento));
    return { ...meta, contenido };
  } catch {
    throw new NotFoundError('El archivo no está disponible en el almacenamiento');
  }
}

/** Lee un archivo subido en un FormData (campo `archivo`). */
export async function archivoDeFormulario(form: FormData, campo = 'archivo') {
  const valor = form.get(campo);
  if (!(valor instanceof File) || valor.size === 0) throw new ValidationError('Adjunte un archivo');
  return {
    contenido: Buffer.from(await valor.arrayBuffer()),
    nombreOriginal: valor.name || 'archivo',
    tipoMime: valor.type || 'application/octet-stream',
  };
}

export const RAIZ_ALMACENAMIENTO = RAIZ;
