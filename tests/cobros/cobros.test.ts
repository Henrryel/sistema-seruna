import { randomUUID } from 'node:crypto';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { db, sql, transaccion } from '@/server/db';
import { aErrorDominio } from '@/server/errores';
import * as cuotas from '@/server/services/cobros/cuotas';
import * as pagos from '@/server/services/cobros/pagos';
import * as caja from '@/server/services/cobros/caja';
import * as reportes from '@/server/services/cobros/reportes';
import * as portal from '@/server/services/cobros/portal';
import * as planes from '@/server/services/cobros/planes';
import { cuotasDeMatricula } from '@/server/repositories/cobros/cuotas';
import type { DatosPago } from '@/esquemas/cobros/pagos';
import { hoyLima } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearUsuario, vincularApoderado } from '@tests/fixtures/base';
import { agregarMatricula, escenarioCobros } from '@tests/fixtures/cobros';

// Vitest transforma JSX con el runtime clásico: los PDF (@react-pdf) necesitan React en el ámbito global.
(globalThis as { React?: typeof React }).React = React;

function pago(datos: Partial<DatosPago> & Pick<DatosPago, 'matriculaId' | 'serieId'>): DatosPago {
  return {
    claveIdempotencia: randomUUID(),
    medio: 'efectivo',
    referencia: null,
    importe: '300.00',
    imputacion: 'regla',
    aplicaciones: [],
    cuotas: [],
    pagante: { personaId: undefined, tipoDocumento: 'DNI', numeroDocumento: '12345678', nombre: 'Madre de prueba', direccion: null },
    ...datos,
  };
}

const saldoDe = async (matriculaId: string, concepto: string, numero = 1) =>
  (await cuotasDeMatricula(matriculaId)).find((c) => c.concepto === concepto && c.numero === numero)?.saldo;

describe('cobros y caja', () => {
  it('plan publicado → cuotas emitidas por sección replicando sus tramos (reemitir no duplica)', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      const otra = await agregarMatricula({
        anioId: e.anio.anioId,
        gradoId: e.gradoId,
        seccionId: e.matricula.seccionId,
        inicio: e.anio.inicio,
        fin: e.anio.fin,
        registradoPor: e.admin.usuarioId,
      });
      const r = await cuotas.emitirCuotas(e.admin.actor, { alcance: 'seccion', seccionId: e.matricula.seccionId, anioId: undefined, gradoId: undefined, matriculaId: undefined });
      expect(r.errores).toEqual([]);
      expect(r.matriculas).toBe(2);
      expect(r.emitidas).toBe(22); // matrícula + 10 pensiones por alumno
      const lista = await cuotasDeMatricula(otra.matriculaId);
      expect(lista).toHaveLength(11);
      const marzo = lista.find((c) => c.mes_servicio === '2025-03-01');
      expect(marzo).toMatchObject({ concepto: 'pension', numero: 1, importe: '450.00', exigible_desde: '2025-03-31', vence_en: '2025-03-31' });

      const otraVez = await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      expect(otraVez).toMatchObject({ emitidas: 0, omitidas: 11 });

      // El plan publicado no se edita: se crea una versión nueva.
      await esperarError(
        planes.crearTramo(e.admin.actor, e.plan.id, { concepto: 'ingreso', numero: 1, importe: '100.00', mesServicio: null, exigibleDesde: '2025-01-01', venceEn: '2025-01-31' }),
        'Conflict',
        /nueva versión/,
      );
      // La base exige que la cuota replique exactamente un tramo publicado.
      const tramo = await db().selectFrom('tramos_plan_cobro').select(['id', 'concepto']).where('plan_id', '=', e.plan.id).where('concepto', '=', 'matricula').executeTakeFirstOrThrow();
      const manipulada = await transaccion(() =>
        db()
          .insertInto('cuotas')
          .values({
            matricula_id: otra.matriculaId,
            estudiante_id: otra.estudianteId,
            anio_id: e.anio.anioId,
            grado_id: e.gradoId,
            tramo_id: tramo.id,
            concepto: 'matricula',
            numero: 1,
            importe: '1.00',
            exigible_desde: '2025-01-01',
            vence_en: '2025-02-28',
          })
          .execute(),
      ).catch(aErrorDominio);
      expect(manipulada).toMatchObject({ tipo: 'Validation', message: /reproducir un tramo válido/ });
    }));

  it('pago idempotente: la misma clave devuelve el mismo pago y recibo', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      const datos = pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '500.00' });
      const r1 = await pagos.registrarPago(e.admin.actor, datos);
      const r2 = await pagos.registrarPago(e.admin.actor, datos);
      expect(r1.repetido).toBe(false);
      expect(r2).toEqual({ ...r1, repetido: true });
      const n = await db().selectFrom('pagos').select((eb) => eb.fn.countAll<string>().as('n')).where('clave_idempotencia', '=', datos.claveIdempotencia).executeTakeFirstOrThrow();
      expect(Number(n.n)).toBe(1);
      // Regla "más antigua primero": matrícula (300) y 200 a la pensión de marzo.
      const detalle = await pagos.obtenerPago(r1.pagoId);
      expect(detalle.aplicaciones.map((a) => [a.concepto, a.importe, a.imputacion])).toEqual([
        ['matricula', '300.00', 'regla'],
        ['pension', '200.00', 'regla'],
      ]);
      expect(await saldoDe(e.matricula.matriculaId, 'pension')).toBe('250.00');
    }));

  it('la base rechaza un abono que excede el saldo de la cuota', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      const matricula = (await cuotasDeMatricula(e.matricula.matriculaId)).find((c) => c.concepto === 'matricula');
      const datos = pago({
        matriculaId: e.matricula.matriculaId,
        serieId: e.caja.serieId,
        importe: '350.00',
        imputacion: 'eleccion_pagante',
        aplicaciones: [{ cuotaId: matricula?.id ?? '0', importe: '350.00' }],
      });
      await esperarError(pagos.registrarPago(e.admin.actor, datos), 'Validation', 'El abono excede el saldo de la cuota');
      // Por regla, el excedente sobre todas las cuotas exigibles también lo rechaza la base.
      await esperarError(
        pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '99999.00' })),
        'Validation',
        'El abono excede el saldo de la cuota',
      );
      // Nada quedó registrado (una sola transacción).
      const n = await db().selectFrom('pagos').select((eb) => eb.fn.countAll<string>().as('n')).where('clave_idempotencia', '=', datos.claveIdempotencia).executeTakeFirstOrThrow();
      expect(Number(n.n)).toBe(0);
    }));

  it('recibos con correlativo de la serie elegida', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      const a = await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '100.00' }));
      const b = await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '100.00', medio: 'yape', referencia: '0012345' }));
      expect(a.recibo).toBe(`${e.caja.codigo}-00000001`);
      expect(b.recibo).toBe(`${e.caja.codigo}-00000002`);
      const serie = await db().selectFrom('series_recibos').select('siguiente_numero').where('id', '=', e.caja.serieId).executeTakeFirstOrThrow();
      expect(serie.siguiente_numero).toBe('3');
      // Yape se guarda como transferencia con la referencia "Yape: <nro>".
      const yape = await db().selectFrom('pagos').select(['medio', 'referencia', 'sesion_caja_id']).where('id', '=', b.pagoId).executeTakeFirstOrThrow();
      expect(yape).toMatchObject({ medio: 'transferencia', referencia: 'Yape: 0012345' });
      expect((await pagos.obtenerPago(b.pagoId)).medio_ui).toBe('yape');
      const pdf = await pagos.reciboPdf(a.pagoId);
      expect(pdf.contenido.subarray(0, 4).toString()).toBe('%PDF');
    }));

  it('reversión total reabre el saldo y el recibo queda inmutable', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      const r = await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '300.00' }));
      expect(await saldoDe(e.matricula.matriculaId, 'matricula')).toBe('0.00');
      await pagos.revertirPago(e.admin.actor, r.pagoId, { motivo: 'Pago registrado por error' });
      expect(await saldoDe(e.matricula.matriculaId, 'matricula')).toBe('300.00');
      await esperarError(pagos.revertirPago(e.admin.actor, r.pagoId, { motivo: 'Otra vez' }), 'Conflict', /ya fue revertido/);
      const detalle = await pagos.obtenerPago(r.pagoId);
      expect(detalle.reversion?.motivo).toBe('Pago registrado por error');
      expect(detalle.recibo?.numero).toBe('1');
      // El arqueo ya no cuenta el efectivo revertido.
      const arqueo = await caja.arqueo(e.caja.sesionId ?? '0');
      expect(arqueo.arqueo).toMatchObject({ efectivo_cobrado: '0.00', efectivo_revertido: '300.00', esperado: '100.00' });
    }));

  it('UPDATE/DELETE de registros financieros rechazado por la base', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      const r = await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '300.00' }));
      const intentos: (() => Promise<unknown>)[] = [
        () => db().updateTable('pagos').set({ importe: '1.00' }).where('id', '=', r.pagoId).execute(),
        () => db().deleteFrom('recibos_caja').where('pago_id', '=', r.pagoId).execute(),
        () => db().deleteFrom('aplicaciones_pago').where('pago_id', '=', r.pagoId).execute(),
        () => db().updateTable('cuotas').set({ importe: '1.00' }).where('matricula_id', '=', e.matricula.matriculaId).execute(),
      ];
      for (const intento of intentos) {
        const error = await transaccion(intento).catch(aErrorDominio);
        expect(error).toMatchObject({ tipo: 'Conflict', message: /Registre un ajuste o reversión para corregir/ });
      }
    }));

  it('morosidad al corte con reporte_cuotas_al_corte, ajustes y devoluciones', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      // Paga matrícula y marzo completos; abril queda con descuento de 50.
      const r = await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '750.00' }));
      const abril = (await cuotasDeMatricula(e.matricula.matriculaId)).find((c) => c.mes_servicio === '2025-04-01');
      await cuotas.registrarAjuste(e.admin.actor, abril?.id ?? '0', { tipo: 'descuento', importe: '-50.00', motivo: 'Descuento por hermanos' });
      await esperarError(
        cuotas.registrarAjuste(e.admin.actor, abril?.id ?? '0', { tipo: 'exoneracion', importe: '-999.00', motivo: 'Exceso de exoneración' }),
        'Validation',
        /saldo negativo/,
      );
      // Devolución de 20 sobre la aplicación de marzo: el saldo de marzo vuelve a 20.
      const detalle = await pagos.obtenerPago(r.pagoId);
      const aplicacionMarzo = detalle.aplicaciones.find((a) => a.mes_servicio === '2025-03-01');
      await pagos.registrarDevolucion(e.admin.actor, r.pagoId, { aplicacionId: aplicacionMarzo?.id ?? '0', importe: '20.00', motivo: 'Cobro duplicado de mora', enEfectivo: true });
      await esperarError(
        pagos.registrarDevolucion(e.admin.actor, r.pagoId, { aplicacionId: aplicacionMarzo?.id ?? '0', importe: '500.00', motivo: 'Devolución excesiva', enEfectivo: false }),
        'Validation',
        /excede lo aplicado/,
      );

      // Al corte de hoy: matrícula pagada (no figura); marzo debe 20 (devolución); abril 400 (450 − 50); mayo–diciembre 450.
      const consulta = { anioId: e.anio.anioId, corte: hoyLima(), soloVencidas: true, gradoId: undefined, seccionId: undefined, concepto: undefined, q: undefined };
      const { filas, total } = await reportes.morosidad(consulta, null);
      expect(total).toBe(10);
      expect(filas.slice(0, 3).map((f) => [f.concepto, f.mes_servicio, f.saldo])).toEqual([
        ['pension', '2025-03-01', '20.00'],
        ['pension', '2025-04-01', '400.00'],
        ['pension', '2025-05-01', '450.00'],
      ]);
      expect(filas[1]).toMatchObject({ ajustes: '-50.00', abonado: '0.00', matricula_id: e.matricula.matriculaId });
      expect(filas[1]?.dias_atraso).toBeGreaterThan(0);
      const resumen = await reportes.resumenMorosidad({ ...consulta });
      expect(resumen).toMatchObject({ cuotas: 10, alumnos: 1, vencido: '4020.00', saldo: '4020.00' });
      // Un corte anterior a la emisión no incluye esas cuotas (la función filtra por emitida_en).
      expect((await reportes.morosidad({ ...consulta, corte: '2025-05-15' }, null)).total).toBe(0);
      // Arqueo: inicial 100 + efectivo 750 − devolución en efectivo 20.
      const cierre = await caja.cerrarSesion(e.admin.actor, e.caja.sesionId ?? '0', { saldoContado: '830.00' });
      expect(cierre).toMatchObject({ esperado: '830.00', saldo_contado: '830.00', diferencia: '0.00' });
    }));

  it('efectivo exige sesión de caja abierta del operador', () =>
    enPrueba(async () => {
      const e = await escenarioCobros({ abrirCaja: false });
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      await esperarError(
        pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId })),
        'Validation',
        /abra primero su sesión de caja/,
      );
      const r = await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, medio: 'transferencia', referencia: 'OP-123' }));
      expect(r.recibo).toBe(`${e.caja.codigo}-00000001`);
    }));

  it('portales: padre sin acceso económico recibe Forbidden; el recibo solo para su alumno', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      const r = await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '300.00' }));

      const sinAcceso = await crearUsuario({ roles: ['apoderado'] });
      await vincularApoderado({ estudianteId: e.matricula.estudianteId, personaId: sinAcceso.personaId, verificadoPor: e.admin.usuarioId, economico: false });
      const actorSinAcceso = await actorDe(sinAcceso);
      await esperarError(portal.estadoCuentaPadre(actorSinAcceso, e.matricula.estudianteId), 'Forbidden', /pagos/);
      const detalle = await pagos.obtenerPago(r.pagoId);
      await esperarError(portal.reciboPadre(actorSinAcceso, e.matricula.estudianteId, detalle.recibo?.id ?? '0'), 'Forbidden');

      const conAcceso = await crearUsuario({ roles: ['apoderado'] });
      await vincularApoderado({ estudianteId: e.matricula.estudianteId, personaId: conAcceso.personaId, verificadoPor: e.admin.usuarioId, economico: true });
      const cuenta = await portal.estadoCuentaPadre(await actorDe(conAcceso), e.matricula.estudianteId);
      expect(cuenta.cuotas).toHaveLength(11);
      expect(cuenta.pagos).toHaveLength(1);
      expect(cuenta.pagos[0]).toMatchObject({ importe: '300.00', recibo: `${e.caja.codigo}-00000001`, revertido: false });
      const pdf = await portal.reciboPadre(await actorDe(conAcceso), e.matricula.estudianteId, detalle.recibo?.id ?? '0');
      expect(pdf.contenido.length).toBeGreaterThan(1000);

      // El alumno ve su cuenta, pero no el recibo de otro estudiante.
      const alumnoUsuario = await crearUsuario({ roles: ['alumno'] });
      const otro = await agregarMatricula({
        anioId: e.anio.anioId,
        gradoId: e.gradoId,
        seccionId: e.matricula.seccionId,
        inicio: e.anio.inicio,
        fin: e.anio.fin,
        registradoPor: e.admin.usuarioId,
      });
      await db().updateTable('estudiantes').set({ persona_id: alumnoUsuario.personaId }).where('id', '=', otro.estudianteId).execute();
      const actorAlumno = await actorDe(alumnoUsuario);
      const propia = await portal.estadoCuentaEstudiante(actorAlumno);
      expect(propia.matricula?.id).toBe(otro.matriculaId);
      await esperarError(portal.reciboEstudiante(actorAlumno, detalle.recibo?.id ?? '0'), 'Forbidden', /no corresponde/);
    }));

  it('series y sesiones: una sesión abierta por operador; serie con recibos conserva su código', () =>
    enPrueba(async () => {
      const e = await escenarioCobros();
      await esperarError(caja.abrirSesion(e.admin.actor, { cajaId: e.caja.cajaId, saldoInicial: '0' }), 'Conflict');
      await cuotas.emitirCuotas(e.admin.actor, { alcance: 'matricula', matriculaId: e.matricula.matriculaId, anioId: undefined, gradoId: undefined, seccionId: undefined });
      await pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '10.00' }));
      await esperarError(caja.actualizarSerie(e.admin.actor, e.caja.serieId, { codigo: 'REC-OTRA', numeroInicial: 1, activa: true }), 'Conflict');
      await caja.actualizarSerie(e.admin.actor, e.caja.serieId, { codigo: e.caja.codigo, numeroInicial: 1, activa: false });
      // Serie inactiva: la base no emite el recibo y el pago completo se revierte.
      await esperarError(
        pagos.registrarPago(e.admin.actor, pago({ matriculaId: e.matricula.matriculaId, serieId: e.caja.serieId, importe: '10.00' })),
        'Validation',
        /serie de recibos/,
      );
      const conteo = await sql<{ n: string }>`select count(*) as n from pagos p join sesiones_caja s on s.id = p.sesion_caja_id where s.id = ${e.caja.sesionId}::bigint`.execute(db());
      expect(conteo.rows[0]?.n).toBe('1');
    }));
});
