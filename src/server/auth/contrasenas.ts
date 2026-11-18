import 'server-only';
import { hash, verify } from '@node-rs/argon2';

// Argon2id con parámetros recomendados por OWASP; se guarda en formato PHC ($argon2id$v=19$m=...,t=...,p=...$sal$hash).
const OPCIONES = { algorithm: 2 /* Algorithm.Argon2id (const enum) */, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export async function hashContrasena(contrasena: string): Promise<string> {
  return hash(contrasena, OPCIONES);
}

/** Verifica sin lanzar: un hash con formato desconocido o vacío se considera inválido. */
export async function verificarContrasena(hashGuardado: string | null, contrasena: string): Promise<boolean> {
  if (!hashGuardado || !hashGuardado.startsWith('$argon2')) return false;
  try {
    return await verify(hashGuardado, contrasena);
  } catch {
    return false;
  }
}

// Hash ficticio para igualar tiempos cuando el login no existe (evita enumeración de usuarios).
let hashFicticio: Promise<string> | undefined;
export async function verificarContrasenaFicticia(contrasena: string): Promise<void> {
  hashFicticio ??= hashContrasena('contrasena-ficticia-para-igualar-tiempos');
  await verificarContrasena(await hashFicticio, contrasena);
}
