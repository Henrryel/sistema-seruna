import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/** Token aleatorio de 32 bytes en base64url (para sesiones, activación y recuperación). */
export function generarToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 del token (32 bytes). La base solo guarda este hash, nunca el token. */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}
