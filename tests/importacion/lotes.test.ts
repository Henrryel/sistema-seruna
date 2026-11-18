import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as importacion from '@/server/services/importacion/lotes';
import { esquemaLote } from '@/esquemas/importacion/lotes';
import { parsearArchivoImportacion, parsearCsv } from '@/esquemas/importacion/parseo';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearUsuario, sufijo } from '@tests/fixtures/base';

const archivo = (nombre: string, texto: string) => ({ nombreOriginal: nombre, contenido: Buffer.from(texto, 'utf8') });

const CSV_ESTUDIANTES = 'id;primer_nombre;apellido;fecha_nacimiento\n101;Ana;"Quispe Mamani";2015-04-02\n102;Luis;Torres;\n';
const JSON_NOTAS = JSON.stringify([{ id: 'n-1', id_estudiante: '101', bimestre: 1, nota: 'A' }]);

describe('lectura de archivos de importación', () => {
  it('lee CSV con separador ; y comillas, y JSON; detecta claves repetidas', () => {
    expect(parsearCsv('a,b\n"x, y","con ""comillas"""\n')).toEqual([{ a: 'x, y', b: 'con "comillas"' }]);
    const filas = parsearArchivoImportacion(CSV_ESTUDIANTES, 'estudiantes.csv', 'id');
    expect(filas.map((f) => f.claveOrigen)).toEqual(['101', '102']);
    expect(filas[1]?.datos).toEqual({ id: '102', primer_nombre: 'Luis', apellido: 'Torres', fecha_nacimiento: null });
    expect(parsearArchivoImportacion(JSON.stringify({ notas: [{ id: 1 }] }), 'n.json', 'id')).toHaveLength(1);
    expect(() => parsearArchivoImportacion('id\n1\n1\n', 'x.csv', 'id')).toThrow(/repetida/);
  });
});

describe('lote de importación histórica', () => {
  it('carga → revisión → conciliación → cerrado', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const sistema = `colegio_${sufijo()}`;
      const datos = esquemaLote.parse({
        sistema: `  ${sistema.toUpperCase()} `.trim(),
        conteos: { estudiantes: 2, notas_bimestre: 1 },
        archivos: [{ entidad: 'estudiantes' }, { entidad: 'notas_bimestre', columnaClave: 'id' }],
      });
      expect(datos.sistema).toBe(sistema);
      const lote = await importacion.crearLote(admin.actor, datos, [archivo('estudiantes.csv', CSV_ESTUDIANTES), archivo('notas.json', JSON_NOTAS)]);
      expect(lote).toMatchObject({ estado: 'carga', filas: 3 });

      // El mismo contenido del mismo sistema no puede cargarse dos veces (UNIQUE sistema, sha256).
      await esperarError(
        importacion.crearLote(admin.actor, datos, [archivo('estudiantes.csv', CSV_ESTUDIANTES), archivo('notas.json', JSON_NOTAS)]),
        'Conflict',
      );

      // No se puede conciliar mientras está en carga.
      await esperarError(
        importacion.conciliarFila(admin.actor, lote.id, { entidad: 'estudiantes', claveOrigen: '102', accion: 'excluir', motivo: 'Duplicado' }),
        'Validation',
        /revisión/,
      );

      expect(await importacion.avanzarLote(admin.actor, lote.id)).toEqual({ estado: 'revision' });
      // Ya sellado: no admite más filas.
      await esperarError(importacion.cargarArchivos(admin.actor, lote.id, [{ entidad: 'estudiantes', columnaClave: 'id' }], [archivo('mas.csv', 'id;primer_nombre\n103;Eva\n')]), 'Validation', /en carga/);

      const codigo = `H-${sufijo()}`;
      const creado = await importacion.conciliarFila(admin.actor, lote.id, {
        entidad: 'estudiantes',
        claveOrigen: '101',
        accion: 'crear',
        motivo: 'Alumna sin registro en el sistema actual',
        codigo,
      });
      expect(creado.accion).toBe('crear');
      const estudiante = await db().selectFrom('estudiantes').select(['codigo', 'activo']).where('id', '=', creado.destino_id ?? '0').executeTakeFirstOrThrow();
      expect(estudiante).toEqual({ codigo, activo: false });
      await importacion.conciliarFila(admin.actor, lote.id, { entidad: 'estudiantes', claveOrigen: '102', accion: 'excluir', motivo: 'Registro de prueba del sistema anterior' });
      await esperarError(
        importacion.conciliarFila(admin.actor, lote.id, { entidad: 'estudiantes', claveOrigen: '102', accion: 'archivar', motivo: 'Cambio de opinión' }),
        'Conflict',
        /ya está conciliada/,
      );
      await esperarError(
        importacion.conciliarFila(admin.actor, lote.id, { entidad: 'notas_bimestre', claveOrigen: 'n-1', accion: 'vincular', motivo: 'x', destinoId: '1' }),
        'Validation',
        /archivo histórico/,
      );
      await esperarError(importacion.avanzarLote(admin.actor, lote.id), 'Validation', /pendientes/);

      expect(await importacion.conciliarPendientes(admin.actor, lote.id, { entidad: 'notas_bimestre', accion: 'archivar', motivo: 'Se conserva como histórico' })).toEqual({
        conciliadas: 1,
      });
      expect(await importacion.avanzarLote(admin.actor, lote.id)).toEqual({ estado: 'cerrado' });

      const detalle = await importacion.detalleLote(lote.id);
      expect(detalle).toMatchObject({ estado: 'cerrado', cargadas: 3, pendientes: 0 });
      expect(detalle.resumen).toEqual([
        { entidad: 'estudiantes', cargadas: 2, creadas: 1, vinculadas: 0, archivadas: 0, excluidas: 1, pendientes: 0 },
        { entidad: 'notas_bimestre', cargadas: 1, creadas: 0, vinculadas: 0, archivadas: 1, excluidas: 0, pendientes: 0 },
      ]);
      const historico = await importacion.listarArchivoHistorico({ sistema }, { limite: 10, desplazamiento: 0 });
      expect(historico.total).toBe(1);
      expect(historico.filas[0]).toMatchObject({ entidad: 'notas_bimestre', clave_origen: 'n-1', motivo: 'Se conserva como histórico', datos: { nota: 'A' } });
      const filas = await importacion.listarFilas(lote.id, { estado: 'pendiente' }, { limite: 10, desplazamiento: 0 });
      expect(filas.total).toBe(0);
    }));

  it('la base rechaza conteos distintos del manifiesto, credenciales, anidados y operadores sin permiso', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const sistema = `sis_${sufijo()}`;
      const lote = await importacion.crearLote(admin.actor, esquemaLote.parse({ sistema, conteos: { estudiantes: 5 }, archivos: [{ entidad: 'estudiantes' }] }), [
        archivo('e.csv', CSV_ESTUDIANTES),
      ]);
      await esperarError(importacion.avanzarLote(admin.actor, lote.id), 'Validation', /manifiesto/);

      await esperarError(
        importacion.crearLote(admin.actor, esquemaLote.parse({ sistema, conteos: { profesores: 1 }, archivos: [{ entidad: 'profesores' }] }), [
          archivo('p.json', JSON.stringify([{ id: 1, nombre: 'Rosa', password: 'secreto' }])),
        ]),
        'Validation',
        /credenciales/,
      );
      await esperarError(
        importacion.crearLote(admin.actor, esquemaLote.parse({ sistema, conteos: { cursos: 1 }, archivos: [{ entidad: 'cursos' }] }), [
          archivo('c.json', JSON.stringify([{ id: 1, horario: { lunes: '8:00' } }])),
        ]),
        'Validation',
        /estructura no permitida/,
      );

      const sinPermiso = await actorDe(await crearUsuario({ roles: ['docente'] }));
      await esperarError(importacion.avanzarLote(sinPermiso, lote.id), 'Forbidden', /conciliar datos históricos/);
    }));
});
