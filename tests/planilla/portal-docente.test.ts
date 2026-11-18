import { describe, expect, it } from 'vitest';
import * as liquidaciones from '@/server/services/planilla/liquidaciones';
import * as portal from '@/server/services/planilla/portal-docente';
import * as horas from '@/server/services/planilla/horas';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearDocente, crearUsuario } from '@tests/fixtures/base';
import { crearContrato, finDeMes, mesFuturo, mesPasado } from '@tests/fixtures/planilla';

describe('planilla: portal docente (alcance propio)', () => {
  it('el docente ve solo sus contratos, horas y liquidaciones aprobadas, y solo descarga su boleta', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const uA = await crearUsuario({ roles: ['docente'] });
      const uB = await crearUsuario({ roles: ['docente'] });
      const a = await crearDocente({ personaId: uA.personaId });
      const b = await crearDocente({ personaId: uB.personaId });
      const mes = mesFuturo();
      const periodo = await liquidaciones.abrirPeriodo(admin.actor, { mes });
      const ids: Record<string, string> = {};
      for (const [clave, docenteId] of [
        ['a', a.docenteId],
        ['b', b.docenteId],
      ] as const) {
        const c = await crearContrato({
          docenteId,
          registradoPor: admin.usuarioId,
          modalidad: 'fijo',
          inicio: `${mes}-01`,
          fin: finDeMes(mes),
        });
        const l = await liquidaciones.crearLiquidacion(admin.actor, {
          contratoId: c.id,
          periodoId: periodo.id,
          importeFijo: null,
          motivoProrrateo: null,
        });
        await liquidaciones.aprobar(admin.actor, l.id);
        ids[clave] = l.id;
      }
      // Un borrador propio en otro período no se muestra al docente.
      let mes2 = mesFuturo();
      while (mes2 === mes) mes2 = mesFuturo();
      const periodo2 = await liquidaciones.abrirPeriodo(admin.actor, { mes: mes2 });
      const c2 = await crearContrato({
        docenteId: a.docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'fijo',
        inicio: `${mes2}-01`,
        fin: finDeMes(mes2),
      });
      const borrador = await liquidaciones.crearLiquidacion(admin.actor, {
        contratoId: c2.id,
        periodoId: periodo2.id,
        importeFijo: null,
        motivoProrrateo: null,
      });

      // Horas propias y ajenas.
      const mesH = mesPasado();
      const phA = await crearContrato({
        docenteId: a.docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'por_horas',
        inicio: `${mesH}-01`,
        fin: finDeMes(mesH),
      });
      const phB = await crearContrato({
        docenteId: b.docenteId,
        registradoPor: admin.usuarioId,
        modalidad: 'por_horas',
        inicio: `${mesH}-01`,
        fin: finDeMes(mesH),
      });
      const horaA = await horas.registrarHora(admin.actor, {
        contratoId: phA.id,
        fecha: `${mesH}-05`,
        horaInicio: '08:00',
        horaFin: '09:00',
        motivo: 'Clase',
        sesionId: undefined,
      });
      await horas.registrarHora(admin.actor, {
        contratoId: phB.id,
        fecha: `${mesH}-05`,
        horaInicio: '08:00',
        horaFin: '09:00',
        motivo: 'Clase',
        sesionId: undefined,
      });

      const actorA = await actorDe(uA);
      expect(actorA.portales).toContain('docente');
      const r = await portal.resumen(actorA);
      expect(r.liquidaciones.map((l) => l.id)).toEqual([ids.a]);
      expect(r.liquidaciones.map((l) => l.id)).not.toContain(borrador.id);
      expect(r.contratos).toHaveLength(3);
      expect(r.liquidaciones[0]).toMatchObject({ estado: 'aprobada', neto: '3000.00', saldo: '3000.00' });

      const h = await portal.listarHoras(actorA, {}, { limite: 20, desplazamiento: 0 });
      expect(h.filas.map((f) => f.id)).toEqual([horaA.id]);

      const propia = await portal.boleta(actorA, ids.a as string);
      expect(propia.contenido.subarray(0, 4).toString()).toBe('%PDF');
      await esperarError(portal.boleta(actorA, ids.b as string), 'NotFound');
      await esperarError(portal.boleta(actorA, borrador.id), 'NotFound');

      // Un usuario sin perfil docente no tiene planilla propia.
      await esperarError(portal.resumen(admin.actor), 'Forbidden');
    }));
});
