import { randomUUID } from 'node:crypto';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { responderListado } from '@/server/http/listado';
import * as planes from '@/server/services/cobros/planes';
import * as cuotas from '@/server/services/cobros/cuotas';
import * as pagos from '@/server/services/cobros/pagos';
import * as caja from '@/server/services/cobros/caja';
import * as reportes from '@/server/services/cobros/reportes';
import { cuotasDeMatricula } from '@/server/repositories/cobros/cuotas';
import { hoyLima } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearAdmin, crearAnio, gradoId } from '@tests/fixtures/base';
import { crearCondiciones, escenarioCobros } from '@tests/fixtures/cobros';

(globalThis as { React?: typeof React }).React = React;

const P = { limite: 50, desplazamiento: 0 };

describe('planes de cobro', () => {
  it('publicar exige tramos y condiciones del año; el publicado solo cambia con una nueva versión', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnio();
      const grado = await gradoId('secundaria', 2);
      const plan = await planes.crearPlan(admin.actor, { anioId: anio.anioId, gradoId: grado, pensionReferencia: '500.00', vigenteDesde: '2025-01-01', condicionesId: undefined });
      expect(plan.version).toBe(1);
      await esperarError(planes.publicarPlan(admin.actor, plan.id), 'Validation', /al menos un tramo/);
      await planes.crearTramo(admin.actor, plan.id, { concepto: 'matricula', numero: 1, importe: '400.00', mesServicio: null, exigibleDesde: '2025-01-01', venceEn: '2025-02-28' });
      await esperarError(planes.publicarPlan(admin.actor, plan.id), 'Validation', /condiciones económicas/);
      const condiciones = await crearCondiciones(anio.anioId);
      // La base valida los tramos (CHECK): una pensión exigible antes de fin de mes se rechaza.
      await esperarError(
        planes.crearTramo(admin.actor, plan.id, { concepto: 'pension', numero: 1, importe: '500.00', mesServicio: '2025-03-01', exigibleDesde: '2025-03-15', venceEn: '2025-03-31' }),
        'Validation',
      );
      const r = await planes.generarPensiones(admin.actor, plan.id, { mesInicio: '2025-03', cantidad: 10, importe: null, diasGracia: 5 });
      expect(r.creados).toBe(10);
      const pub = await planes.publicarPlan(admin.actor, plan.id);
      expect(pub.publicadoEn).toBeTruthy();
      const { plan: publicado, tramos } = await planes.obtenerPlan(plan.id);
      expect(publicado).toMatchObject({ condiciones_id: condiciones.id, tramos: 11, total: '5400.00' });
      expect(tramos.at(-1)).toMatchObject({ concepto: 'pension', numero: 10, mes_servicio: '2025-12-01', exigible_desde: '2025-12-31', vence_en: '2026-01-05' });
      await esperarError(planes.actualizarPlan(admin.actor, plan.id, { pensionReferencia: '1.00', vigenteDesde: '2025-01-01', condicionesId: undefined }), 'Conflict');

      const v2 = await planes.nuevaVersion(admin.actor, plan.id);
      expect(v2.version).toBe(2);
      const copia = await planes.obtenerPlan(v2.id);
      expect(copia.plan.publicado_en).toBeNull();
      expect(copia.tramos).toHaveLength(11);
      await planes.actualizarTramo(admin.actor, copia.tramos[0]?.id ?? '0', { concepto: 'matricula', numero: 1, importe: '450.00', mesServicio: null, exigibleDesde: '2025-01-01', venceEn: '2025-02-28' });
      const listado = await planes.listarPlanes({ anioId: anio.anioId }, P);
      expect(listado.filas.map((f) => [f.version, Boolean(f.publicado_en)])).toEqual([
        [2, false],
        [1, true],
      ]);
    }));

  it('obligación de ingreso: la cuota de ingreso solo en la matrícula de ingreso y sin superar lo acordado', () =>
    enPrueba(async () => {
      const e = await escenarioCobros({ ingreso: '500.00' });
      // Sin obligación: se omite la cuota de ingreso con aviso.
      const sin = await cuotas.emitirCuotas(e.admin.actor, { alcance: 'seccion', seccionId: e.matricula.seccionId, anioId: undefined, gradoId: undefined, matriculaId: undefined });
      expect(sin).toMatchObject({ emitidas: 11, errores: [] });
      expect(sin.avisos[0]).toMatch(/sin obligación de ingreso/);
      // Acordado menor que el tramo: la base rechaza la emisión (no supera lo acordado).
      const o = await planes.crearObligacion(e.admin.actor, { matriculaId: e.matricula.matriculaId, importeAcordado: '400.00', condicionesId: undefined });
      await esperarError(
        cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined }),
        'Validation',
        'Las cuotas superan el importe de ingreso acordado',
      );
      await planes.actualizarObligacion(e.admin.actor, o.id, { importeAcordado: '500.00', condicionesId: undefined });
      const con = await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      expect(con).toMatchObject({ emitidas: 1, omitidas: 11 });
      const ingreso = (await cuotasDeMatricula(e.matricula.matriculaId)).find((c) => c.concepto === 'ingreso');
      expect(ingreso).toMatchObject({ importe: '500.00', saldo: '500.00' });
      await esperarError(planes.actualizarObligacion(e.admin.actor, o.id, { importeAcordado: '900.00', condicionesId: undefined }), 'Conflict');
      const { filas } = await planes.listarObligaciones({ anioId: e.anio.anioId }, P);
      expect(filas[0]).toMatchObject({ importe_acordado: '500.00', emitido: '500.00', cuotas: 1 });
    }));

  it('la emisión rechaza matrículas no activas', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await db().updateTable('matriculas').set({ estado: 'retirada' }).where('id', '=', e.matricula.matriculaId).execute();
      await esperarError(
        cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined }),
        'Validation',
        /matrícula activa/,
      );
      const grado = await cuotas.emitirCuotas(e.admin.actor, { alcance: 'grado', anioId: e.anio.anioId, gradoId: e.gradoId, seccionId: undefined, matriculaId: undefined });
      expect(grado).toMatchObject({ matriculas: 0, emitidas: 0 });
    }));
});

describe('listados y exportaciones de cobros', () => {
  it('ejecutan sus consultas con todos los filtros y exportan a Excel/PDF', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      const yape = await pagos.registrarPago(e.admin.actor, {
        claveIdempotencia: randomUUID(),
        matriculaId: e.matricula.matriculaId,
        serieId: e.caja.serieId,
        medio: 'yape',
        referencia: '778899',
        importe: '350.00',
        imputacion: 'regla',
        aplicaciones: [],
        cuotas: [],
        pagante: { personaId: undefined, tipoDocumento: null, numeroDocumento: null, nombre: 'Tía de prueba', direccion: null },
      });

      for (const estado of ['pagado', 'pendiente', 'vencido', 'parcial'] as const) {
        await cuotas.listarCuotas({ anioId: e.anio.anioId, estado }, P);
      }
      const vencidas = await cuotas.listarCuotas({ anioId: e.anio.anioId, seccionId: e.matricula.seccionId, concepto: 'pension', estado: 'vencido', q: 'prueba' }, P);
      expect(vencidas.total).toBe(10); // la pensión de marzo tiene abono parcial pero ya venció
      const pagadas = await cuotas.listarCuotas({ matriculaId: e.matricula.matriculaId, estado: 'pagado' }, P);
      expect(pagadas.filas.map((f) => f.concepto)).toEqual(['matricula']);

      const lista = await pagos.listarPagos({ medio: 'yape', estado: 'vigente', desde: hoyLima(), hasta: hoyLima(), estudianteId: e.matricula.estudianteId, q: 'tía' }, P);
      expect(lista.filas).toHaveLength(1);
      expect(lista.filas[0]).toMatchObject({ id: yape.pagoId, medio_ui: 'yape', revertido: false, devuelto: '0.00' });
      expect((await pagos.listarPagos({ q: yape.recibo }, P)).total).toBe(1);
      expect((await pagos.listarPagos({ sesionId: e.caja.sesionId ?? undefined }, P)).total).toBe(1);

      const est = await db().selectFrom('estudiantes').select('codigo').where('id', '=', e.matricula.estudianteId).executeTakeFirstOrThrow();
      const alumnos = await pagos.buscarAlumnos(est.codigo);
      expect(alumnos[0]).toMatchObject({ estudiante_id: e.matricula.estudianteId, matricula_id: e.matricula.matriculaId, estado_matricula: 'activa', grado: '1.º Primaria' });
      const cuenta = await pagos.cuentaParaCobro(e.matricula.estudianteId);
      expect(cuenta.matricula?.id).toBe(e.matricula.matriculaId);
      expect(cuenta.cuotas[0]).toMatchObject({ concepto: 'pension', saldo: '400.00', abonado: '50.00' });

      const nombreCaja = (await db().selectFrom('cajas').select('nombre').where('id', '=', e.caja.cajaId).executeTakeFirstOrThrow()).nombre;
      expect((await caja.listarCajas({ q: nombreCaja }, P)).filas[0]).toMatchObject({ id: e.caja.cajaId, sesion_abierta_id: e.caja.sesionId, activa: true });
      expect((await caja.listarSeries({ q: e.caja.codigo }, P)).filas[0]).toMatchObject({ recibos: 1, siguiente_numero: '2' });
      const sesiones = await caja.listarSesiones({ estado: 'abierta', cajaId: e.caja.cajaId, desde: hoyLima(), hasta: hoyLima() }, P);
      expect(sesiones.filas[0]).toMatchObject({ esperado: '100.00', diferencia: null });
      const actual = await caja.sesionActual(e.admin.actor);
      expect(actual.arqueo).toMatchObject({ otros_medios: '350.00', efectivo_cobrado: '0.00' });

      const rec = await reportes.recaudacion(hoyLima(), hoyLima());
      expect(rec.totales.pagos).toBeGreaterThanOrEqual(1);
      expect(rec.porMedio.find((m) => m.medio === 'yape')?.pagos).toBeGreaterThanOrEqual(1);

      const consulta = { anioId: e.anio.anioId, corte: undefined, gradoId: e.gradoId, seccionId: e.matricula.seccionId, concepto: 'pension' as const, soloVencidas: false, q: 'prueba' };
      const mor = await reportes.morosidad(consulta, P);
      expect(mor.total).toBe(10);
      for (const formato of ['xlsx', 'pdf'] as const) {
        const r = await responderListado({ pagina: 1, porPagina: 20, formato }, {
          titulo: 'Morosidad al corte',
          columnas: [
            { titulo: 'Alumno', valor: 'alumno' },
            { titulo: 'Saldo', valor: 'saldo', formato: 'moneda' },
          ],
          obtener: (p) => reportes.morosidad(consulta, p),
        });
        expect(r).toBeInstanceOf(Response);
        expect((await (r as Response).arrayBuffer()).byteLength).toBeGreaterThan(500);
      }
    }));
});
