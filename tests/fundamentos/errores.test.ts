import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { db, sql, transaccion } from '@/server/db';
import { aErrorDominio, traducirErrorDb } from '@/server/errores';
import { MENSAJES_DB, PATRONES_DB } from '@/server/errores/mensajes-db';
import { enPrueba } from '@tests/helpers/db';
import { crearAdmin, crearAnio } from '@tests/fixtures/base';
import { crearAnio as crearAnioServicio } from '@/server/services/academico/anios';

describe('traducción de errores de la base', () => {
  it('cubre todos los mensajes RAISE EXCEPTION de las funciones reales', async () => {
    const funciones = await db()
      .selectFrom(sql<{ prosrc: string }>`(select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'excelencia_seruna')`.as('f'))
      .select('f.prosrc')
      .execute();
    const mensajes = new Set<string>();
    for (const f of funciones) for (const m of f.prosrc.matchAll(/RAISE EXCEPTION\s+'((?:[^']|'')*)'/g)) mensajes.add((m[1] ?? '').replace(/''/g, "'"));
    const sinTraduccion = [...mensajes].filter((m) => !(m in MENSAJES_DB) && !PATRONES_DB.some((p) => m.startsWith(p.prefijo)));
    expect(sinTraduccion, 'Regenere con npm run db:errores').toEqual([]);
    expect(mensajes.size).toBe(134);
  });

  it('el catálogo versionado coincide con el generado', () => {
    const catalogo = JSON.parse(readFileSync('docs/db/catalogo.json', 'utf8')) as { funciones: unknown[] };
    expect(catalogo.funciones).toHaveLength(43);
  });

  it('traduce un RAISE EXCEPTION real a su tipo de dominio y sigue operando tras el SAVEPOINT', () =>
    enPrueba(async () => {
      let capturado: unknown;
      try {
        await transaccion(() => sql`select excelencia_seruna.registrar_marcacion(gen_random_uuid(), 'entrada', -1)`.execute(db()));
      } catch (e) {
        capturado = e;
      }
      const error = traducirErrorDb(capturado);
      expect(error?.tipo).toBe('Forbidden');
      expect(error?.message).toBe('La marcación requiere un operador activo');
      const sigue = await sql<{ uno: number }>`select 1 as uno`.execute(db());
      expect(sigue.rows[0]?.uno).toBe(1);
    }));

  it('traduce UNIQUE (23505) y EXCLUDE (23P01) a Conflict', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnio();
      const e1 = await crearAnioServicio(admin.actor, { anio: anio.anio, inicio: anio.inicio, fin: anio.fin, estado: 'borrador' }).catch(aErrorDominio);
      expect(e1).toMatchObject({ tipo: 'Conflict', message: 'Ese año académico ya existe' });
      const e2 = await db()
        .insertInto('bimestres')
        .values({ anio_id: anio.anioId, numero: 1, inicio: anio.inicio, fin: anio.inicio })
        .execute()
        .catch(aErrorDominio);
      expect(e2).toMatchObject({ tipo: 'Conflict' });
    }));
});
