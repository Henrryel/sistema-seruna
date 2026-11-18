import { randomInt, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as liquidaciones from '@/server/services/planilla/liquidaciones';
import * as horas from '@/server/services/planilla/horas';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearAdmin, crearDocente } from '@tests/fixtures/base';
import {
  crearContrato,
  finDeMes,
  mesFuturo,
  mesPasado,
  prepararAsistenciaDocente,
} from '@tests/fixtures/planilla';

describe('planilla: liquidaciones', () => {
  it('fijo: descuento por tardanza desde la asistencia (excluye justificadas), aprobación y pago hasta el saldo', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const { docenteId, personaId } = await crearDocente();
      const anio = 2001 + randomInt(24);
      await crearContrato({
        docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'fijo',
        inicio: `${anio}-01-01`,
        fin: `${anio}-12-31`,
        sueldo: '3000.00',
      });
      // 5 jornadas de 08:00 a 13:00 (300 min) con tolerancia de 5 min → 1500 min programados en mayo.
      await prepararAsistenciaDocente({
        docenteId,
        personaId,
        registradoPor: admin.usuarioId,
        anio,
        mes: 5,
        dias: [
          { dia: 4, estado: 'presente', entrada: '07:58' },
          { dia: 5, estado: 'tarde', entrada: '08:17' }, // 12 min
          { dia: 6, estado: 'tarde', entrada: '08:30' }, // 25 min
          { dia: 7, estado: 'justificado', entrada: '08:40' }, // excluida
          { dia: 8, estado: 'sin_registro' },
        ],
      });
      const periodo = await liquidaciones.abrirPeriodo(admin.actor, { mes: `${anio}-05` });
      const contrato = await db()
        .selectFrom('contratos_docentes')
        .select('id')
        .where('docente_id', '=', docenteId)
        .executeTakeFirstOrThrow();
      const { id } = await liquidaciones.crearLiquidacion(admin.actor, {
        contratoId: contrato.id,
        periodoId: periodo.id,
        importeFijo: null,
        motivoProrrateo: null,
      });

      const detalle = await liquidaciones.obtenerDetalle(id);
      expect(detalle.estado).toBe('borrador');
      expect(detalle.importe_fijo).toBe('3000.00'); // la base congela el sueldo del contrato
      expect(detalle.totales.base).toBe('3000.00');

      const previa = await liquidaciones.vistaPreviaTardanzas(id);
      expect(previa.dias.map((d) => d.minutos)).toEqual([12, 25]);
      expect(previa.minutos).toBe(37);
      expect(previa.minutos_base).toBe(1500);
      expect(Number(previa.valor_minuto)).toBe(2);
      expect(previa.importe).toBe('74.00');
      expect(previa.concepto).toBe('Tardanzas (37 min)');

      await liquidaciones.registrarTardanzas(admin.actor, id);
      await esperarError(liquidaciones.registrarTardanzas(admin.actor, id), 'Conflict', /ya está registrado/);
      await liquidaciones.agregarLinea(admin.actor, id, {
        tipo: 'adicional',
        concepto: 'Bono por tutoría',
        importe: '100.00',
      });

      await liquidaciones.aprobar(admin.actor, id);
      const aprobada = await liquidaciones.obtenerDetalle(id);
      expect(aprobada.estado).toBe('aprobada');
      expect(aprobada.lineas.find((l) => l.tipo === 'descuento')).toMatchObject({
        concepto: 'Tardanzas (37 min)',
        importe: '74.00',
      });
      expect(aprobada.totales).toMatchObject({
        base: '3000.00',
        adicionales: '100.00',
        descuentos: '74.00',
        neto: '3026.00',
        saldo: '3026.00',
      });

      // La liquidación aprobada ya no admite cambios.
      await esperarError(
        liquidaciones.agregarLinea(admin.actor, id, { tipo: 'descuento', concepto: 'Otro', importe: '1' }),
        'Conflict',
        /aprobada no admite cambios/,
      );
      await esperarError(liquidaciones.eliminarBorrador(admin.actor, id), 'Conflict');

      await esperarError(
        liquidaciones.registrarPago(admin.actor, id, {
          claveIdempotencia: randomUUID(),
          importe: '3026.01',
          medio: 'transferencia',
          referencia: null,
        }),
        'Validation',
        /excede el saldo/,
      );
      await liquidaciones.registrarPago(admin.actor, id, {
        claveIdempotencia: randomUUID(),
        importe: '3026.00',
        medio: 'transferencia',
        referencia: 'OP-1',
      });
      expect((await liquidaciones.obtenerDetalle(id)).totales.saldo).toBe('0.00');
    }));

  it('por horas: incluye solo horas aprobadas; aprobar con horas pendientes o sin incluir lo rechaza la base', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const { docenteId } = await crearDocente();
      const mes = mesPasado();
      const inicio = `${mes}-01`;
      const contrato = await crearContrato({
        docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'por_horas',
        inicio,
        fin: finDeMes(mes),
        tarifa: '30.0000',
        minutosPorHora: 45,
      });
      const periodo = await liquidaciones.abrirPeriodo(admin.actor, { mes });
      const fecha = `${mes}-10`;
      const registrar = (horaInicio: string, horaFin: string) =>
        horas.registrarHora(admin.actor, {
          contratoId: contrato.id,
          fecha,
          horaInicio,
          horaFin,
          motivo: 'Reemplazo',
          sesionId: undefined,
        });
      const h1 = await registrar('08:00', '09:30');
      const h2 = await registrar('10:00', '11:30');
      const h3 = await registrar('14:00', '15:00');
      const h4 = await registrar('16:00', '17:00');
      expect(h1.minutos).toBe(90);
      await horas.resolverHora(admin.actor, h1.id, { estado: 'aprobada', decision: 'Conforme' });
      await horas.resolverHora(admin.actor, h2.id, { estado: 'aprobada', decision: 'Conforme' });
      await horas.resolverHora(admin.actor, h3.id, { estado: 'rechazada', decision: 'No corresponde' });
      // Una hora resuelta no se vuelve a resolver.
      await esperarError(
        horas.resolverHora(admin.actor, h1.id, { estado: 'rechazada', decision: 'x' }),
        'Conflict',
      );

      const { id, horasIncluidas } = await liquidaciones.crearLiquidacion(admin.actor, {
        contratoId: contrato.id,
        periodoId: periodo.id,
        importeFijo: '50',
        motivoProrrateo: 'ignorado',
      });
      expect(horasIncluidas).toBe(2);
      let detalle = await liquidaciones.obtenerDetalle(id);
      expect(
        detalle.lineas
          .filter((l) => l.tipo === 'horas')
          .map((l) => l.hora_docente_id)
          .sort(),
      ).toEqual([h1.id, h2.id].sort());
      expect(detalle.totales).toMatchObject({ minutos_aprobados: 180, base: '120.00' });
      expect(detalle.horas_pendientes).toBe(1);

      // h4 sigue pendiente → la base rechaza la aprobación.
      await esperarError(
        liquidaciones.aprobar(admin.actor, id),
        'Validation',
        /Resuelva las horas pendientes/,
      );
      await horas.resolverHora(admin.actor, h4.id, { estado: 'aprobada', decision: 'Conforme' });
      // Aprobada pero sin incluir → sigue rechazada.
      await esperarError(
        liquidaciones.aprobar(admin.actor, id),
        'Validation',
        /incluya todas las horas aprobadas/,
      );
      expect((await liquidaciones.incluirHoras(admin.actor, id)).horasIncluidas).toBe(1);
      await liquidaciones.aprobar(admin.actor, id);
      detalle = await liquidaciones.obtenerDetalle(id);
      expect(detalle.totales).toMatchObject({
        minutos_aprobados: 240,
        base: '160.00',
        neto: '160.00',
        saldo: '160.00',
      });

      // Con la liquidación aprobada la base ya no admite horas del mes para ese contrato.
      await esperarError(registrar('18:00', '19:00'), 'Validation', /liquidación o período cerrado/);
    }));

  it('pagos: no exceden el saldo, son idempotentes y se revierten con motivo', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const { docenteId } = await crearDocente();
      const mes = mesFuturo();
      const contrato = await crearContrato({
        docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'fijo',
        inicio: `${mes}-01`,
        fin: finDeMes(mes),
        sueldo: '1500.00',
      });
      const periodo = await liquidaciones.abrirPeriodo(admin.actor, { mes });
      const { id } = await liquidaciones.crearLiquidacion(admin.actor, {
        contratoId: contrato.id,
        periodoId: periodo.id,
        importeFijo: null,
        motivoProrrateo: null,
      });

      await esperarError(
        liquidaciones.registrarPago(admin.actor, id, {
          claveIdempotencia: randomUUID(),
          importe: '10',
          medio: 'efectivo',
          referencia: null,
        }),
        'Validation',
        /requiere una liquidación aprobada/,
      );
      await liquidaciones.aprobar(admin.actor, id);

      const clave = randomUUID();
      const p1 = await liquidaciones.registrarPago(admin.actor, id, {
        claveIdempotencia: clave,
        importe: '1000.00',
        medio: 'transferencia',
        referencia: 'OP-9',
      });
      const repetido = await liquidaciones.registrarPago(admin.actor, id, {
        claveIdempotencia: clave,
        importe: '1000.00',
        medio: 'transferencia',
        referencia: 'OP-9',
      });
      expect(repetido).toEqual({ id: p1.id, repetido: true });
      expect((await liquidaciones.obtenerDetalle(id)).totales.saldo).toBe('500.00');
      await esperarError(
        liquidaciones.registrarPago(admin.actor, id, {
          claveIdempotencia: randomUUID(),
          importe: '500.01',
          medio: 'efectivo',
          referencia: null,
        }),
        'Validation',
        /excede el saldo/,
      );

      await liquidaciones.revertirPago(admin.actor, p1.id, { motivo: 'Cuenta equivocada' });
      let detalle = await liquidaciones.obtenerDetalle(id);
      expect(detalle.totales).toMatchObject({ abonado: '0', saldo: '1500.00' });
      expect(detalle.pagos[0]).toMatchObject({ id: p1.id, motivo_reversion: 'Cuenta equivocada' });
      await esperarError(liquidaciones.revertirPago(admin.actor, p1.id, { motivo: 'Otra vez' }), 'Conflict');

      await liquidaciones.registrarPago(admin.actor, id, {
        claveIdempotencia: randomUUID(),
        importe: '1500.00',
        medio: 'transferencia',
        referencia: 'OP-10',
      });
      detalle = await liquidaciones.obtenerDetalle(id);
      expect(detalle.totales.saldo).toBe('0.00');

      const bitacora = await db()
        .selectFrom('bitacora')
        .select(['accion', 'entidad'])
        .where('entidad', 'in', ['pagos_docentes', 'reversiones_pago_docente', 'liquidaciones_docentes'])
        .where('actor_id', '=', admin.usuarioId)
        .execute();
      expect(bitacora.map((b) => b.accion)).toEqual(
        expect.arrayContaining(['aprobar', 'registrar', 'revertir']),
      );
    }));

  it('fijo con vigencia parcial exige importe y motivo; período no cierra con borradores', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const { docenteId } = await crearDocente();
      const mes = mesFuturo();
      const contrato = await crearContrato({
        docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'fijo',
        inicio: `${mes}-16`,
        fin: `${Number(mes.slice(0, 4)) + 1}-12-31`,
        sueldo: '3000.00',
      });
      const periodo = await liquidaciones.abrirPeriodo(admin.actor, { mes });
      await esperarError(liquidaciones.abrirPeriodo(admin.actor, { mes }), 'Conflict');
      await esperarError(
        liquidaciones.crearLiquidacion(admin.actor, {
          contratoId: contrato.id,
          periodoId: periodo.id,
          importeFijo: null,
          motivoProrrateo: null,
        }),
        'Validation',
        /sueldo parcial requiere importe autorizado y motivo/,
      );
      const { id } = await liquidaciones.crearLiquidacion(admin.actor, {
        contratoId: contrato.id,
        periodoId: periodo.id,
        importeFijo: '1500.00',
        motivoProrrateo: 'Ingresó a mitad de mes',
      });
      const d = await liquidaciones.obtenerDetalle(id);
      expect(d.vigencia_inicio).toBe(`${mes}-16`);
      expect(d.totales.base).toBe('1500.00');

      await esperarError(liquidaciones.cerrarPeriodo(admin.actor, periodo.id), 'Validation', /pendientes/);
      await liquidaciones.aprobar(admin.actor, id);
      await liquidaciones.cerrarPeriodo(admin.actor, periodo.id);
      const periodos = await liquidaciones.listarPeriodos();
      expect(periodos.find((p) => p.id === periodo.id)?.estado).toBe('cerrado');
      // Con el período cerrado no se crean más liquidaciones.
      const { docenteId: otro } = await crearDocente();
      const c2 = await crearContrato({
        docenteId: otro,
        registradoPor: admin.usuarioId,
        modalidad: 'fijo',
        inicio: `${mes}-01`,
        fin: finDeMes(mes),
      });
      await esperarError(
        liquidaciones.crearLiquidacion(admin.actor, {
          contratoId: c2.id,
          periodoId: periodo.id,
          importeFijo: null,
          motivoProrrateo: null,
        }),
        'Conflict',
        /cerrado/,
      );
    }));

  it('borrador: se quitan líneas y se elimina; la boleta PDF se genera', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const { docenteId } = await crearDocente();
      const mes = mesFuturo();
      const contrato = await crearContrato({
        docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'fijo',
        inicio: `${mes}-01`,
        fin: finDeMes(mes),
      });
      const periodo = await liquidaciones.abrirPeriodo(admin.actor, { mes });
      const { id } = await liquidaciones.crearLiquidacion(admin.actor, {
        contratoId: contrato.id,
        periodoId: periodo.id,
        importeFijo: null,
        motivoProrrateo: null,
      });
      const linea = await liquidaciones.agregarLinea(admin.actor, id, {
        tipo: 'descuento',
        concepto: 'Adelanto',
        importe: '200',
      });
      expect((await liquidaciones.obtenerDetalle(id)).totales.neto).toBe('2800.00');
      const pdf = await liquidaciones.boleta(id);
      expect(pdf.contenido.subarray(0, 4).toString()).toBe('%PDF');
      expect(pdf.nombre).toMatch(/borrador/);
      await liquidaciones.eliminarLinea(admin.actor, id, linea.id);
      expect((await liquidaciones.obtenerDetalle(id)).lineas).toHaveLength(0);
      await liquidaciones.eliminarBorrador(admin.actor, id);
      await esperarError(liquidaciones.obtenerDetalle(id), 'NotFound');
    }));
});
