import { kysely, ejecutarEn } from '@/server/db';
import { ErrorDominio, aErrorDominio } from '@/server/errores';
import { expect } from 'vitest';

class Revertir extends Error {}

/**
 * Ejecuta la prueba dentro de una transacción que SIEMPRE se revierte: la base de pruebas queda intacta.
 * Los servicios usan `transaccion()`, que dentro de esta transacción crea SAVEPOINTs, así que una
 * operación que falla (p. ej. un trigger) no impide seguir consultando en la misma prueba.
 */
export async function enPrueba(fn: () => Promise<void>): Promise<void> {
  try {
    await kysely()
      .transaction()
      .execute(async (trx) => {
        await ejecutarEn(trx, fn);
        throw new Revertir();
      });
  } catch (e) {
    if (!(e instanceof Revertir)) throw e;
  }
}

/** Espera que la promesa falle con un error de dominio del tipo indicado (y opcionalmente el mensaje). */
export async function esperarError(promesa: Promise<unknown>, tipo: ErrorDominio['tipo'], mensaje?: string | RegExp) {
  let error: ErrorDominio | null = null;
  try {
    await promesa;
  } catch (e) {
    error = aErrorDominio(e);
  }
  expect(error, 'se esperaba un error').not.toBeNull();
  expect(error?.tipo, error?.message).toBe(tipo);
  if (mensaje) expect(error?.message).toMatch(mensaje);
  return error as ErrorDominio;
}
