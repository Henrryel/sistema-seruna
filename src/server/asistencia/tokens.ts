import 'server-only';
import { randomBytes } from 'node:crypto';
import { hashToken } from '@/server/auth/tokens';

// Token de credencial QR / Code 128.
// - Alfanumérico en MAYÚSCULAS (alfabeto Crockford base32, sin I, L, O, U): cabe en el modo
//   alfanumérico del QR, se codifica en Code 128 y los lectores USB que "teclean" lo reproducen
//   sin depender de la distribución del teclado (no hay símbolos).
// - 20 caracteres = 100 bits de entropía.
// - La base guarda SOLO hashToken(token) (SHA-256, 32 bytes): `credenciales_qr.token_hash`.

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LONGITUD_TOKEN = 20;

export function generarTokenCredencial(): string {
  const bytes = randomBytes(Math.ceil((LONGITUD_TOKEN * 5) / 8));
  let bits = 0;
  let acumulado = 0;
  let salida = '';
  for (const b of bytes) {
    acumulado = (acumulado << 8) | b;
    bits += 8;
    while (bits >= 5 && salida.length < LONGITUD_TOKEN) {
      bits -= 5;
      salida += ALFABETO[(acumulado >> bits) & 31];
    }
    acumulado &= (1 << bits) - 1;
  }
  return salida;
}

/**
 * Normaliza el texto leído por cámara o lector USB: mayúsculas y sin espacios, saltos de línea
 * ni separadores que algunos lectores agregan (prefijos/sufijos, Tab, Enter).
 */
export function normalizarCodigoLeido(texto: string): string {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Hash que se compara con `credenciales_qr.token_hash`. */
export function hashCodigoLeido(texto: string): Buffer {
  return hashToken(normalizarCodigoLeido(texto));
}
