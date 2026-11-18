// Fixtures del módulo de reportes, dashboard e importación. Usar SIEMPRE dentro de enPrueba().
import { randomUUID } from 'node:crypto';
import { db, sql } from '@/server/db';

/** Plantilla publicada (versión aleatoria alta para no chocar con datos existentes). */
export async function crearPlantillaPublicada(opciones: {
  anioId: string;
  creadaPor: string;
  tipo: string;
  formato?: 'pdf' | 'xlsx';
  configuracion?: Record<string, unknown>;
}) {
  return db()
    .insertInto('plantillas_documento')
    .values({
      tipo: opciones.tipo,
      anio_id: opciones.anioId,
      formato: opciones.formato ?? 'pdf',
      version: 1,
      nombre: `Plantilla ${opciones.tipo}`,
      configuracion: sql`${JSON.stringify(opciones.configuracion ?? {})}::jsonb`,
      creada_por: opciones.creadaPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()
    .then(async (p) => {
      await db().updateTable('plantillas_documento').set({ publicada_en: sql`clock_timestamp()` }).where('id', '=', p.id).execute();
      return p;
    });
}

export const nuevoUuid = () => randomUUID();
