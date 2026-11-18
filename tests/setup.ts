import { afterAll } from 'vitest';
import { kysely } from '@/server/db';

if (!process.env.DATABASE_URL_TEST && !process.env.DATABASE_URL) {
  throw new Error('Defina DATABASE_URL_TEST (base restaurada desde db/seruna_back.dump) para las pruebas de integración');
}
process.env.STORAGE_DIR ??= './storage-test';

afterAll(async () => {
  await kysely().destroy();
  (globalThis as { __serunaDb?: unknown }).__serunaDb = undefined;
});
