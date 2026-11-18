import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import type { DB } from './tipos';

export type { DB } from './tipos';
export type Ejecutor = Kysely<DB> | Transaction<DB>;

// `date` se devuelve como texto 'YYYY-MM-DD' (sin conversión a Date ni corrimiento de zona horaria).
pg.types.setTypeParser(1082, (v: string) => v);

function urlConexion(): string {
  const url = process.env.NODE_ENV === 'test' ? (process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL) : process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL (ver .env.example)');
  return url;
}

function ssl(): pg.PoolConfig['ssl'] {
  const v = process.env.DATABASE_SSL;
  if (v === 'true') return true;
  if (v === 'no-verify') return { rejectUnauthorized: false };
  return undefined;
}

function crear(): Kysely<DB> {
  const pool = new pg.Pool({
    connectionString: urlConexion(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: ssl(),
    application_name: 'seruna-app',
    // La base es la fuente de verdad: esquema y zona horaria fijos por conexión.
    options: '-c search_path=excelencia_seruna,public -c timezone=America/Lima',
  });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

const global_ = globalThis as unknown as { __serunaDb?: Kysely<DB> };

/** Instancia raíz (pool). Se crea al primer uso para que `next build` no exija base de datos. */
export function kysely(): Kysely<DB> {
  global_.__serunaDb ??= crear();
  return global_.__serunaDb;
}

const contexto = new AsyncLocalStorage<Transaction<DB>>();

/** Ejecutor actual: la transacción en curso (si la hay) o el pool. Úsalo SIEMPRE en repositorios. */
export function db(): Ejecutor {
  return contexto.getStore() ?? kysely();
}

let contadorSavepoint = 0;

/**
 * Ejecuta `fn` en una transacción. Si ya hay una en curso, usa un SAVEPOINT: un error
 * revierte solo el bloque interno y la transacción externa puede continuar.
 */
export async function transaccion<T>(fn: (trx: Transaction<DB>) => Promise<T>): Promise<T> {
  const actual = contexto.getStore();
  if (actual) {
    const nombre = `sp_${++contadorSavepoint}`;
    await sql.raw(`savepoint ${nombre}`).execute(actual);
    try {
      const resultado = await fn(actual);
      await sql.raw(`release savepoint ${nombre}`).execute(actual);
      return resultado;
    } catch (error) {
      await sql.raw(`rollback to savepoint ${nombre}`).execute(actual);
      throw error;
    }
  }
  return kysely()
    .transaction()
    .execute((trx) => contexto.run(trx, () => fn(trx)));
}

/** Solo para pruebas: ejecuta `fn` dentro de una transacción ya abierta. */
export function ejecutarEn<T>(trx: Transaction<DB>, fn: () => Promise<T>): Promise<T> {
  return contexto.run(trx, fn);
}

export { sql };
