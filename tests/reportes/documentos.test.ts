import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db';
import * as plantillas from '@/server/services/reportes/plantillas';
import * as documentos from '@/server/services/reportes/documentos';
import { procesarCola } from '@/server/services/reportes/worker';
import { columnasDocumento, valorExportable } from '@/server/services/reportes/generador';
import { esquemaPlantilla } from '@/esquemas/reportes/plantillas';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearAnio, crearMatriculaActiva, crearUsuario } from '@tests/fixtures/base';
import { crearPlantillaPublicada, nuevoUuid } from '@tests/fixtures/reportes';

// Vitest compila JSX con el runtime clásico (tsconfig usa "jsx": "preserve" para Next): los PDF de
// @react-pdf (src/server/pdf/**) necesitan `React` global solo en pruebas. Next usa el runtime automático.
vi.stubGlobal('React', React);

const estadoDe = (id: string) =>
  db().selectFrom('documentos_emitidos').select(['estado', 'archivo_id', 'procesado_por', 'motivo_fallo']).where('id', '=', id).executeTakeFirstOrThrow();

describe('plantillas de documento', () => {
  it('crea borrador, publica (inmutable) y versiona', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnio();
      const datos = esquemaPlantilla.parse({ tipo: 'nomina', anioId: anio.anioId, formato: 'pdf', nombre: 'Nómina oficial', configuracion: '{"horizontal": true}' });
      const p = await plantillas.crearPlantilla(admin.actor, datos);
      expect(p.version).toBe(1);
      await plantillas.actualizarPlantilla(admin.actor, p.id, { ...datos, nombre: 'Nómina por sección' });
      await plantillas.publicarPlantilla(admin.actor, p.id);
      await esperarError(plantillas.actualizarPlantilla(admin.actor, p.id, { ...datos, nombre: 'Otro' }), 'Validation', /versión nueva/);
      await esperarError(plantillas.publicarPlantilla(admin.actor, p.id), 'Validation', /versión nueva/);
      const v2 = await plantillas.nuevaVersion(admin.actor, p.id);
      expect(v2.version).toBe(2);
      const copia = await plantillas.obtenerPlantilla(v2.id);
      expect(copia).toMatchObject({ nombre: 'Nómina por sección', publicada_en: null, configuracion: { horizontal: true } });
      // La base exige configuración objeto.
      await esperarError(plantillas.crearPlantilla(admin.actor, { ...datos, configuracion: [1, 2] }), 'Validation');
      expect(esquemaPlantilla.safeParse({ ...datos, configuracion: '{mal' }).success).toBe(false);
    }));
});

describe('solicitud de documentos (preparar_documento_reporte)', () => {
  it('es idempotente por UUID y rechaza reutilizar el UUID con otros parámetros', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const m = await crearMatriculaActiva({ registradoPor: admin.usuarioId });
      const p = await crearPlantillaPublicada({ anioId: m.anio.anioId, creadaPor: admin.usuarioId, tipo: 'nomina' });
      const uuid = nuevoUuid();
      const solicitud = { solicitudUuid: uuid, plantillaId: p.id, desde: m.anio.inicio, hasta: m.anio.fin, seccionId: m.seccionId };
      const a = await documentos.solicitarDocumento(admin.actor, solicitud);
      const b = await documentos.solicitarDocumento(admin.actor, solicitud);
      expect(b.id).toBe(a.id);
      expect(a.estado).toBe('preparado');
      const doc = await db().selectFrom('documentos_emitidos').select(['datos', 'parametros']).where('id', '=', a.id).executeTakeFirstOrThrow();
      expect((doc.datos as { filas: unknown[] }).filas).toHaveLength(1);
      await esperarError(documentos.solicitarDocumento(admin.actor, { ...solicitud, seccionId: undefined }), 'Conflict', /otra solicitud/);
      // La base rechaza filtros no admitidos por el tipo.
      await esperarError(
        documentos.solicitarDocumento(admin.actor, { ...solicitud, solicitudUuid: nuevoUuid(), bimestreId: m.anio.bimestres[0]?.id }),
        'Conflict',
        /no admite/,
      );
    }));

  it('la base rechaza a un usuario sin el permiso del tipo de reporte', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnio();
      const p = await crearPlantillaPublicada({ anioId: anio.anioId, creadaPor: admin.usuarioId, tipo: 'asistencia_docentes' });
      const docente = await actorDe(await crearUsuario({ roles: ['docente'] }));
      await esperarError(
        documentos.solicitarDocumento(docente, { solicitudUuid: nuevoUuid(), plantillaId: p.id, desde: anio.inicio, hasta: anio.fin }),
        'Forbidden',
        /no está autorizada/,
      );
      expect(await documentos.tiposPermitidos(docente)).toEqual([]);
    }));
});

describe('worker de la cola de documentos', () => {
  it('emite PDF y XLSX, permite descargar y anular con motivo', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const m = await crearMatriculaActiva({ registradoPor: admin.usuarioId });
      const pdf = await crearPlantillaPublicada({ anioId: m.anio.anioId, creadaPor: admin.usuarioId, tipo: 'nomina', formato: 'pdf' });
      const xlsx = await crearPlantillaPublicada({ anioId: m.anio.anioId, creadaPor: admin.usuarioId, tipo: 'dashboard', formato: 'xlsx' });
      const nom = await documentos.solicitarDocumento(admin.actor, { solicitudUuid: nuevoUuid(), plantillaId: pdf.id, desde: m.anio.inicio, hasta: m.anio.fin });
      const dash = await documentos.solicitarDocumento(admin.actor, {
        solicitudUuid: nuevoUuid(),
        plantillaId: xlsx.id,
        desde: m.anio.inicio,
        hasta: m.anio.fin,
        bimestreId: m.anio.bimestres[0]?.id,
      });

      const resultados = await procesarCola({ soloIds: [nom.id, dash.id], procesadoPor: admin.usuarioId });
      expect(resultados).toEqual([
        { id: nom.id, estado: 'emitido' },
        { id: dash.id, estado: 'emitido' },
      ]);
      expect(await procesarCola({ soloIds: [nom.id, dash.id] })).toEqual([]);

      const ePdf = await estadoDe(nom.id);
      expect(ePdf).toMatchObject({ estado: 'emitido', procesado_por: admin.usuarioId, motivo_fallo: null });
      const archivoPdf = await documentos.descargarDocumento(admin.actor, nom.id);
      expect(archivoPdf.tipo_mime).toBe('application/pdf');
      expect(archivoPdf.contenido.subarray(0, 4).toString()).toBe('%PDF');
      const archivoXlsx = await documentos.descargarDocumento(admin.actor, dash.id);
      expect(archivoXlsx.tipo_mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(archivoXlsx.contenido.subarray(0, 2).toString()).toBe('PK');

      const listado = await documentos.listarDocumentos(admin.actor, { estado: 'emitido' }, { limite: 50, desplazamiento: 0 });
      expect(listado.filas.find((f) => f.id === nom.id)).toMatchObject({ filas: 1, puedeGestionar: true, tipo: 'nomina' });

      // Otro usuario sin el permiso del tipo no puede descargar ni anular.
      const ajeno = await actorDe(await crearUsuario({ roles: ['docente'] }));
      await esperarError(documentos.descargarDocumento(ajeno, nom.id), 'Forbidden');
      await esperarError(documentos.anularDocumento(ajeno, nom.id, 'Sin permiso'), 'Forbidden');

      await documentos.anularDocumento(admin.actor, nom.id, 'Se emitió con datos desactualizados');
      expect(await estadoDe(nom.id)).toMatchObject({ estado: 'anulado' });
      await esperarError(documentos.anularDocumento(admin.actor, nom.id, 'Otra vez'), 'Conflict', /Transición/);
      await esperarError(documentos.descargarDocumento(admin.actor, nom.id), 'Conflict', /anulado/);
      const bitacora = await db()
        .selectFrom('bitacora')
        .select(['accion', 'resultado'])
        .where('entidad', '=', 'documentos_emitidos')
        .where('registro_id', '=', nom.id)
        .orderBy('id')
        .execute();
      expect(bitacora.map((b) => b.resultado)).toEqual(['preparado', 'emitido', 'ok', 'anulado']);
    }));

  it('no se puede anular un documento aún preparado (lo decide la base)', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnio();
      const p = await crearPlantillaPublicada({ anioId: anio.anioId, creadaPor: admin.usuarioId, tipo: 'asistencia_docentes' });
      const d = await documentos.solicitarDocumento(admin.actor, { solicitudUuid: nuevoUuid(), plantillaId: p.id, desde: anio.inicio, hasta: anio.fin });
      await esperarError(documentos.anularDocumento(admin.actor, d.id, 'Prueba'), 'Conflict', /Transición/);
      await esperarError(documentos.descargarDocumento(admin.actor, d.id), 'Conflict', /generando/);
    }));

  it('arma columnas genéricas con las claves de cada fila', () => {
    const filas = [
      { matricula_id: 5, apellidos: 'Pérez', saldo: '10.50', vence_en: '2026-03-31', vigencia: '[2026-03-01,2026-12-21)' },
      { matricula_id: 6, apellidos: 'Ríos', saldo: '0.00', vence_en: '2026-04-30', extra: true },
    ];
    expect(columnasDocumento(filas, {}, 'pdf').map((c) => `${c.clave}:${c.formato}`)).toEqual([
      'apellidos:texto',
      'saldo:moneda',
      'vence_en:fecha',
      'vigencia:texto',
      'extra:booleano',
    ]);
    expect(columnasDocumento(filas, {}, 'xlsx').map((c) => c.clave)).toContain('matricula_id');
    expect(columnasDocumento(filas, { columnas: ['apellidos', { clave: 'saldo', titulo: 'Deuda' }] }, 'pdf').map((c) => c.titulo)).toEqual(['Apellidos', 'Deuda']);
    expect(valorExportable('[2026-03-01,2026-12-21)')).toBe('01/03/2026 – 20/12/2026');
  });
});
