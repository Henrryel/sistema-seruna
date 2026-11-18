import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as contratos from '@/server/services/planilla/contratos';
import * as horas from '@/server/services/planilla/horas';
import * as liquidaciones from '@/server/services/planilla/liquidaciones';
import { leerArchivoPlanilla } from '@/server/services/planilla/archivos';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearAdmin, crearPersona, sufijo } from '@tests/fixtures/base';
import { finDeMes, mesFuturo, mesPasado } from '@tests/fixtures/planilla';

describe('planilla: docentes, contratos y horas', () => {
  it('alta de docente (persona nueva o existente) y contratos sin solapes con documento', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const s = sufijo();
      const dni = String(10_000_000 + Math.floor(Math.random() * 89_999_999)).slice(0, 8);
      const nuevo = await contratos.crearDocente(admin.actor, {
        origen: 'nueva',
        personaId: undefined,
        nombres: 'Rosa',
        apellidos: `Quispe ${s}`,
        dni,
        correo: undefined,
        telefono: null,
        codigo: `DOC-${s}`,
        activo: true,
      });
      const lista = await contratos.listarDocentes({ q: `Quispe ${s}` }, { limite: 10, desplazamiento: 0 });
      expect(lista.filas).toHaveLength(1);
      expect(lista.filas[0]).toMatchObject({ id: nuevo.id, dni, activo: true, contratos: 0 });
      await esperarError(
        contratos.crearDocente(admin.actor, {
          origen: 'existente',
          personaId: nuevo.personaId,
          codigo: `X-${s}`,
          activo: true,
          nombres: undefined,
          apellidos: undefined,
          dni: undefined,
          correo: undefined,
          telefono: null,
        }),
        'Conflict',
        /ya tiene perfil de docente/,
      );

      const persona = await crearPersona({ apellidos: `Existente ${s}` });
      expect((await contratos.buscarPersonas(`Existente ${s}`)).map((p) => p.id)).toEqual([persona.id]);
      const existente = await contratos.crearDocente(admin.actor, {
        origen: 'existente',
        personaId: persona.id,
        codigo: `DOC2-${s}`,
        activo: true,
        nombres: undefined,
        apellidos: undefined,
        dni: undefined,
        correo: undefined,
        telefono: null,
      });
      expect(await contratos.buscarPersonas(`Existente ${s}`)).toEqual([]);

      const mes = mesFuturo();
      const anio = Number(mes.slice(0, 4));
      const datos = {
        docenteId: existente.id,
        referencia: `CT-${s}`,
        inicio: `${anio}-01-01`,
        fin: `${anio}-12-31`,
        modalidad: 'fijo' as const,
        sueldoMensual: '2800.00',
        tarifaHora: null,
        minutosPorHora: null,
      };
      const c = await contratos.crearContrato(admin.actor, datos, {
        contenido: Buffer.from('%PDF-1.4 prueba'),
        nombreOriginal: 'contrato.pdf',
        tipoMime: 'application/pdf',
      });
      // Vigencia solapada con otro contrato del mismo docente → EXCLUDE de la base.
      await esperarError(
        contratos.crearContrato(admin.actor, {
          ...datos,
          referencia: `CT2-${s}`,
          inicio: `${anio}-06-01`,
          fin: `${anio + 1}-05-31`,
        }),
        'Conflict',
        /superpone/,
      );
      const fila = (
        await contratos.listarContratos({ docenteId: existente.id }, { limite: 10, desplazamiento: 0 })
      ).filas[0];
      expect(fila).toMatchObject({
        id: c.id,
        inicio: `${anio}-01-01`,
        fin: `${anio}-12-31`,
        modalidad: 'fijo',
        sueldo_mensual: '2800.00',
        documento_nombre: 'contrato.pdf',
      });
      const archivo = await leerArchivoPlanilla(admin.actor, fila?.documento_id ?? '0');
      expect(archivo.contenido.toString()).toContain('prueba');
      // Solo quien gestiona contratos descarga su documento.
      await esperarError(
        leerArchivoPlanilla({ permisos: ['planilla.pagar'] }, fila?.documento_id ?? '0'),
        'Forbidden',
      );

      // Sin horas ni liquidaciones se puede cambiar todo.
      await contratos.actualizarContrato(admin.actor, c.id, { ...datos, sueldoMensual: '3000.00' });
      // Con una liquidación, la base solo admite cambiar la vigencia (y que siga cubriéndola).
      const periodo = await liquidaciones.abrirPeriodo(admin.actor, { mes });
      await liquidaciones.crearLiquidacion(admin.actor, {
        contratoId: c.id,
        periodoId: periodo.id,
        importeFijo: null,
        motivoProrrateo: null,
      });
      await esperarError(
        contratos.actualizarContrato(admin.actor, c.id, { ...datos, sueldoMensual: '3500.00' }),
        'Conflict',
        /alteraría/,
      );
      await contratos.actualizarContrato(admin.actor, c.id, {
        ...datos,
        sueldoMensual: '3000.00',
        fin: `${anio + 1}-12-31`,
      });
      const actualizado = await contratos.obtenerContrato(c.id);
      expect(actualizado.vigencia).toBe(`[${anio}-01-01,${anio + 2}-01-01)`);

      await contratos.actualizarDocente(admin.actor, existente.id, { codigo: `DOC2-${s}`, activo: false });
      expect((await contratos.listarDocentes({ q: `DOC2-${s}`, activo: false }, null)).total).toBe(1);
    }));

  it('horas: solo contratos por horas, horas ya trabajadas, sin solapes; aprobar exige período abierto', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const s = sufijo();
      const d = await contratos.crearDocente(admin.actor, {
        origen: 'nueva',
        personaId: undefined,
        nombres: 'Luis',
        apellidos: `Horas ${s}`,
        dni: undefined,
        correo: undefined,
        telefono: null,
        codigo: `H-${s}`,
        activo: true,
      });
      const mes = mesPasado();
      const porHoras = await contratos.crearContrato(admin.actor, {
        docenteId: d.id,
        referencia: `PH-${s}`,
        inicio: `${mes}-01`,
        fin: finDeMes(mes),
        modalidad: 'por_horas',
        sueldoMensual: null,
        tarifaHora: '25.5000',
        minutosPorHora: 45,
      });
      const base = { contratoId: porHoras.id, fecha: `${mes}-12`, motivo: 'Taller', sesionId: undefined };
      const h = await horas.registrarHora(
        admin.actor,
        { ...base, horaInicio: '09:00', horaFin: '10:30' },
        { contenido: Buffer.from('foto'), nombreOriginal: 'evidencia.png', tipoMime: 'image/png' },
      );
      await esperarError(
        horas.registrarHora(admin.actor, { ...base, horaInicio: '10:00', horaFin: '11:00' }),
        'Conflict',
        /superpone/,
      );
      await esperarError(
        horas.registrarHora(admin.actor, {
          ...base,
          fecha: '2199-01-10',
          horaInicio: '09:00',
          horaFin: '10:00',
        }),
        'Validation',
        /contrato por horas vigente/,
      );

      const lista = await horas.listarHoras(
        { estado: 'pendiente', contratoId: porHoras.id },
        { limite: 10, desplazamiento: 0 },
      );
      expect(lista.filas).toHaveLength(1);
      expect(lista.filas[0]).toMatchObject({
        id: h.id,
        minutos: 90,
        hora_inicio: '09:00',
        estado: 'pendiente',
      });
      expect(lista.filas[0]?.evidencia_id).not.toBeNull();

      // Sin período del mes no se aprueba (la base lo exige); rechazar sí.
      await esperarError(
        horas.resolverHora(admin.actor, h.id, { estado: 'aprobada', decision: 'OK' }),
        'Validation',
        /Abra el período/,
      );
      await liquidaciones.abrirPeriodo(admin.actor, { mes });
      await horas.resolverHora(admin.actor, h.id, { estado: 'aprobada', decision: 'OK' });
      const auditoria = await db()
        .selectFrom('bitacora')
        .select(['accion', 'resultado'])
        .where('entidad', '=', 'horas_docentes')
        .where('registro_id', '=', h.id)
        .execute();
      expect(auditoria).toEqual(expect.arrayContaining([{ accion: 'resolver', resultado: 'aprobada' }]));

      // Horas futuras: rechazadas por la base.
      const futuro = await contratos.crearContrato(admin.actor, {
        docenteId: d.id,
        referencia: `PHF-${s}`,
        inicio: '2190-01-01',
        fin: '2190-12-31',
        modalidad: 'por_horas',
        sueldoMensual: null,
        tarifaHora: '25',
        minutosPorHora: 60,
      });
      await esperarError(
        horas.registrarHora(admin.actor, {
          ...base,
          contratoId: futuro.id,
          fecha: '2190-03-02',
          horaInicio: '09:00',
          horaFin: '10:00',
        }),
        'Validation',
        /ya trabajadas/,
      );
    }));
});
