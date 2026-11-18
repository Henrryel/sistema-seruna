import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { guardarArchivo } from '@/server/almacenamiento';
import * as comunicaciones from '@/server/services/reportes/comunicaciones';
import { esquemaComunicacion } from '@/esquemas/reportes/comunicaciones';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearAdmin, crearAnio, crearPersona } from '@tests/fixtures/base';

const pdf = (nombre: string) => ({ contenido: Buffer.from('%PDF-1.4 prueba'), nombreOriginal: nombre, tipoMime: 'application/pdf' });

describe('comunicaciones de documentos institucionales', () => {
  it('registra la comunicación a una persona o a un alcance, con evidencia, y la base exige uno de los dos', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnio();
      const archivo = await guardarArchivo(pdf('reglamento.pdf'));
      const doc = await db()
        .insertInto('documentos_institucionales')
        .values({ anio_id: anio.anioId, tipo: 'reglamento', version: 1, archivo_id: archivo.id })
        .returning('id')
        .executeTakeFirstOrThrow();
      const persona = await crearPersona({ nombres: 'Rosa', apellidos: `Huamán ${Date.now()}` });

      const a = await comunicaciones.registrarComunicacion(
        admin.actor,
        esquemaComunicacion.parse({ documentoId: doc.id, destinatarioId: persona.id, comunicadoEn: '2026-03-02T08:30', canal: 'presencial' }),
        pdf('cargo-firmado.pdf'),
      );
      await comunicaciones.registrarComunicacion(
        admin.actor,
        esquemaComunicacion.parse({ documentoId: doc.id, alcance: 'Padres de 1.º de primaria', comunicadoEn: '2026-03-03T10:00', canal: 'correo' }),
      );
      await esperarError(
        comunicaciones.registrarComunicacion(admin.actor, esquemaComunicacion.parse({ documentoId: doc.id, alcance: '  ', comunicadoEn: '2026-03-03T10:00', canal: 'correo' })),
        'Validation',
      );

      const listado = await comunicaciones.listarComunicaciones({ documentoId: doc.id }, { limite: 10, desplazamiento: 0 });
      expect(listado.total).toBe(2);
      const conPersona = listado.filas.find((f) => f.id === a.id);
      expect(conPersona).toMatchObject({ documento_tipo: 'reglamento', destinatario: expect.stringContaining('Rosa'), canal: 'presencial', evidencia_nombre: 'cargo-firmado.pdf' });
      // Hora local de Lima (UTC−5).
      expect(conPersona?.comunicado_en).toBe('2026-03-02T13:30:00.000Z');
      const evidencia = await comunicaciones.evidenciaComunicacion(admin.actor, a.id);
      expect(evidencia.contenido.toString()).toContain('%PDF');
      const personas = await comunicaciones.buscarPersonas('Rosa Huam');
      expect(personas.map((p) => p.valor)).toContain(persona.id);
    }));
});
