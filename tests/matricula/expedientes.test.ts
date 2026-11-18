import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as reglas from '@/server/services/matricula/reglas';
import * as matriculas from '@/server/services/matricula/matriculas';
import * as expedientes from '@/server/services/matricula/expedientes';
import * as documentos from '@/server/services/matricula/documentos';
import { fichaMatriculaPdf } from '@/server/services/matricula/ficha';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearEstudiante, crearPersona, vincularApoderado } from '@tests/fixtures/base';
import { archivoPrueba, crearRegla, crearTipoDocumento, escenarioMatricula } from '@tests/fixtures/matricula';

describe('reglas de matrícula', () => {
  it('versionadas: la publicada no se edita; la nueva versión copia requisitos; la base valida edades', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula();
      const base = {
        anioId: e.anio.anioId,
        gradoId: e.gradoId,
        tipoIngreso: 'traslado' as const,
        solicitudesInicio: '2000-01-01',
        solicitudesFin: '2200-12-31',
        corteEdad: undefined,
        edadMinima: null,
        edadMaxima: null,
        referenciaNormativa: 'RVM 000-2026-MINEDU',
      };
      await esperarError(reglas.crearRegla(e.actor, { ...base, edadMinima: 6 }), 'Validation', /fecha de corte/);
      await esperarError(reglas.crearRegla(e.actor, { ...base, solicitudesFin: '1999-01-01' }), 'Validation', /ventana de solicitudes/);
      const r1 = await reglas.crearRegla(e.actor, base);
      expect(r1.version).toBe(1);
      const td = await crearTipoDocumento();
      await esperarError(
        reglas.guardarRequisito(e.actor, r1.id, { tipoDocumentoId: td.id, obligatorio: true, admiteRegularizacion: false, plazoRegularizacion: '2100-01-01' }),
        'Validation',
        /plazo de regularización/,
      );
      await reglas.guardarRequisito(e.actor, r1.id, { tipoDocumentoId: td.id, obligatorio: true, admiteRegularizacion: true, plazoRegularizacion: undefined });
      await reglas.publicarRegla(e.actor, r1.id);
      await esperarError(reglas.actualizarRegla(e.actor, r1.id, base), 'Conflict', /nueva versión/);
      await esperarError(reglas.guardarRequisito(e.actor, r1.id, { tipoDocumentoId: td.id, obligatorio: false, admiteRegularizacion: false, plazoRegularizacion: undefined }), 'Conflict');
      const r2 = await reglas.nuevaVersion(e.actor, r1.id);
      expect(r2.version).toBe(2);
      expect((await reglas.listarRequisitos(r2.id)).map((q) => q.tipo_documento_id)).toEqual([td.id]);
      const listado = await reglas.listarReglas({ anioId: e.anio.anioId, tipoIngreso: 'traslado' }, null);
      expect(listado.filas.map((f) => [f.version, Boolean(f.publicada_en), f.requisitos])).toEqual([
        [2, false, 1],
        [1, true, 1],
      ]);
    }));
});

describe('expediente y documentos institucionales', () => {
  it('checklist de requisitos vs. documentos: cargar, observar, reemplazar y validar', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula();
      const partida = await crearTipoDocumento('Partida de nacimiento');
      const vacunas = await crearTipoDocumento('Carné de vacunas');
      await db()
        .insertInto('requisitos_matricula')
        .values([
          { regla_id: e.reglaId, tipo_documento_id: partida.id, obligatorio: true },
          { regla_id: e.reglaId, tipo_documento_id: vacunas.id, obligatorio: false, admite_regularizacion: true },
        ])
        .execute();
      const { estudianteId } = await crearEstudiante();
      const { id: matriculaId } = await matriculas.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });

      let check = await expedientes.checklistMatricula(matriculaId);
      expect(check.items.map((i) => [i.nombre, i.estado])).toEqual([
        ['Partida de nacimiento', 'faltante'],
        ['Carné de vacunas', 'en_regularizacion'],
      ]);
      expect(check.completo).toBe(false);

      const doc = await expedientes.cargarDocumento(e.actor, { estudianteId, matriculaId, tipoDocumentoId: partida.id }, archivoPrueba('partida.pdf'));
      expect((await expedientes.checklistMatricula(matriculaId)).items[0]?.estado).toBe('pendiente');
      await expedientes.revisarDocumento(e.actor, doc.id, { estado: 'observado', observacion: 'Ilegible' });
      check = await expedientes.checklistMatricula(matriculaId);
      expect(check.items[0]).toMatchObject({ estado: 'observado', observacion: 'Ilegible' });

      const nuevo = await expedientes.reemplazarDocumento(e.actor, doc.id, archivoPrueba('partida-nitida.pdf'));
      await esperarError(expedientes.revisarDocumento(e.actor, doc.id, { estado: 'validado', observacion: null }), 'Conflict');
      await expedientes.revisarDocumento(e.actor, nuevo.id, { estado: 'validado', observacion: null });
      check = await expedientes.checklistMatricula(matriculaId);
      expect(check).toMatchObject({ completo: true, obligatorios: 1, obligatoriosValidados: 1 });
      const lista = await expedientes.listarDocumentos({ estudianteId }, null);
      expect(lista.filas.map((f) => [f.nombre_archivo, f.estado])).toEqual([
        ['partida-nitida.pdf', 'validado'],
        ['partida.pdf', 'reemplazado'],
      ]);

      // Un documento de otra matrícula/estudiante no corresponde (FK compuesta)
      const otro = await crearEstudiante();
      await esperarError(
        expedientes.cargarDocumento(e.actor, { estudianteId: otro.estudianteId, matriculaId, tipoDocumentoId: partida.id }, archivoPrueba()),
        'Validation',
        /no corresponde al estudiante/,
      );
    }));

  it('documentos institucionales versionados: publicar exige vigencia; aceptación por matrícula', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula();
      await esperarError(
        documentos.cargarDocumentoInstitucional(e.actor, { anioId: e.anio.anioId, tipo: 'reglamento', vigenteDesde: undefined }, archivoPrueba('foto.png', 'image/png')),
        'Validation',
        /PDF/,
      );
      const d1 = await documentos.cargarDocumentoInstitucional(e.actor, { anioId: e.anio.anioId, tipo: 'reglamento', vigenteDesde: undefined }, archivoPrueba('reglamento.pdf'));
      const d2 = await documentos.cargarDocumentoInstitucional(e.actor, { anioId: e.anio.anioId, tipo: 'reglamento', vigenteDesde: undefined }, archivoPrueba('reglamento-v2.pdf'));
      expect([d1.version, d2.version]).toEqual([1, 2]);
      await esperarError(documentos.publicarDocumentoInstitucional(e.actor, d2.id), 'Validation', /vigente desde/);
      await documentos.publicarDocumentoInstitucional(e.actor, d2.id, e.anio.inicio);
      await esperarError(documentos.publicarDocumentoInstitucional(e.actor, d2.id, e.anio.inicio), 'Conflict');

      const { estudianteId } = await crearEstudiante();
      const { id } = await matriculas.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });
      const madre = await crearPersona({ nombres: 'Carmen' });
      await esperarError(matriculas.registrarAceptacion(e.actor, id, { documentoId: d1.id, firmanteId: madre.id, metodo: 'firma_fisica', fecha: undefined }), 'Conflict', /publicados/);
      await matriculas.registrarAceptacion(e.actor, id, { documentoId: d2.id, firmanteId: madre.id, metodo: 'firma_fisica', fecha: e.anio.inicio }, archivoPrueba('firma.pdf'));
      await esperarError(
        matriculas.registrarAceptacion(e.actor, id, { documentoId: d2.id, firmanteId: madre.id, metodo: 'presencial', fecha: undefined }),
        'Conflict',
        /ya aceptó/,
      );
      const detalle = await matriculas.detalleMatricula(id);
      expect(detalle.aceptaciones).toMatchObject([{ documento_id: d2.id, firmante_id: madre.id, metodo: 'firma_fisica', version: 2 }]);
      expect(detalle.documentos.map((d) => d.id)).toEqual([d2.id]);

      const listado = await documentos.listarDocumentosInstitucionales({ anioId: e.anio.anioId }, null);
      expect(listado.filas.map((f) => [f.version, f.vigente_desde, f.aceptaciones])).toEqual([
        [2, e.anio.inicio, 1],
        [1, null, 0],
      ]);
      // Descarga autorizada por referencia
      const archivo = await documentos.descargarArchivo(e.actor, listado.filas[0]?.archivo_id ?? '0');
      expect(archivo.nombre_original).toBe('reglamento-v2.pdf');
    }));
});

describe('ficha de matrícula', () => {
  it('genera el PDF con alumno, sección, apoderados y responsable', () =>
    enPrueba(async () => {
      // Vitest compila JSX con el runtime clásico (tsconfig jsx=preserve): expone React como global.
      (globalThis as { React?: typeof React }).React ??= React;
      const e = await escenarioMatricula();
      const { estudianteId } = await crearEstudiante();
      const madre = await crearPersona({ nombres: 'Carmen', apellidos: 'Flores' });
      await vincularApoderado({ estudianteId, personaId: madre.id, verificadoPor: e.admin.usuarioId });
      const { id } = await matriculas.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'nuevo', referenciaSiagie: null });
      await matriculas.confirmarMatricula(e.actor, id, { seccionId: e.seccionId, fecha: e.anio.inicio, tipoVacante: 'regular', motivo: null });
      await matriculas.registrarResponsable(e.actor, id, {
        personaId: madre.id,
        tipoDocumento: 'DNI',
        numeroDocumento: '44556677',
        nombreRazonSocial: 'Carmen Flores',
        direccion: 'Av. Los Olivos 123',
        desde: e.anio.inicio,
      });
      const { buffer, nombre } = await fichaMatriculaPdf(e.actor, id);
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(buffer.length).toBeGreaterThan(1500);
      expect(nombre).toMatch(/^ficha-matricula-\d{4}-E-/);
      const auditoria = await db().selectFrom('bitacora').select('accion').where('registro_id', '=', id).where('accion', '=', 'descargar_ficha').execute();
      expect(auditoria).toHaveLength(1);
    }));
});

// Regla sin publicar no se usa para solicitar
describe('regla en borrador', () => {
  it('no habilita solicitudes', () =>
    enPrueba(async () => {
      const e = await escenarioMatricula();
      await crearRegla({ anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'continuidad', publicada: false });
      const { estudianteId } = await crearEstudiante();
      await esperarError(
        matriculas.solicitarMatricula(e.actor, { estudianteId, anioId: e.anio.anioId, gradoId: e.gradoId, tipoIngreso: 'continuidad', referenciaSiagie: null }),
        'Validation',
        /No hay una regla/,
      );
    }));
});
