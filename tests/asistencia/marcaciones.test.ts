import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as marcaciones from '@/server/services/asistencia/marcaciones';
import * as credenciales from '@/server/services/asistencia/credenciales';
import { estadoPorEntrada, instanteLocalLima } from '@/server/asistencia/estado';
import { hoyLima, sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearUsuario } from '@tests/fixtures/base';
import {
  crearCredencialPrueba,
  crearEscenarioAlumnos,
  crearEscenarioDocente,
  crearLectorPrueba,
  instanteLima,
} from '@tests/fixtures/asistencia';

const asistenciaDe = (matriculaId: string, jornadaId: string) =>
  db()
    .selectFrom('asistencia_estudiantes')
    .select(['id', 'estado', 'entrada_id', 'salida_id', 'motivo'])
    .where('matricula_id', '=', matriculaId)
    .where('jornada_id', '=', jornadaId)
    .where('sesion_id', 'is', null)
    .execute();

describe('fórmula presente/tarde (misma que validar_asistencia)', () => {
  it('tarde solo si el instante supera estrictamente entrada + tolerancia (µs)', () => {
    const base = { fecha: '2026-03-02', horaEntrada: '08:00:00', toleranciaMinutos: 10 };
    expect(estadoPorEntrada({ ...base, instanteLocal: '2026-03-02T08:10:00.000000' })).toBe('presente');
    expect(estadoPorEntrada({ ...base, instanteLocal: '2026-03-02T08:10:00.000001' })).toBe('tarde');
    expect(estadoPorEntrada({ ...base, instanteLocal: '2026-03-02T07:30:00.5' })).toBe('presente');
    expect(estadoPorEntrada({ ...base, instanteLocal: '2026-03-02T23:59:59' })).toBe('tarde');
    expect(estadoPorEntrada({ ...base, toleranciaMinutos: 0, instanteLocal: '2026-03-02T08:00:00' })).toBe('presente');
    expect(instanteLocalLima(new Date('2026-03-02T13:10:00.123Z'))).toBe('2026-03-02T08:10:00.123000');
  });
});

describe('marcación QR en línea', () => {
  it('es idempotente por evento_uuid y crea la asistencia con el estado de la tolerancia', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, tolerancia: 0 });
      const alumno = esc.alumnos[0]!;
      const { lectorId } = await crearLectorPrueba();
      const { token } = await crearCredencialPrueba({ personaId: alumno.personaId, emitidaPor: admin.usuarioId });
      const evento = randomUUID();

      const r1 = await marcaciones.marcar(admin.actor, { eventoUuid: evento, tipo: 'entrada', lectorId, codigo: token });
      expect(r1.metodo).toBe('qr');
      expect(r1.persona.id).toBe(alumno.personaId);
      expect(r1.persona.perfil).toBe('alumno');
      expect(r1.asistencia.registrada).toBe(true);
      // Jornada 00:00 con tolerancia 0: cualquier entrada del día es tardanza.
      expect(r1.asistencia.estado).toBe('tarde');

      // Reintento con el mismo UUID (y el texto leído con minúsculas/espacios): misma marcación, sin duplicar.
      const r2 = await marcaciones.marcar(admin.actor, { eventoUuid: evento, tipo: 'entrada', lectorId, codigo: ` ${token.toLowerCase()}\n` });
      expect(r2.marcacionId).toBe(r1.marcacionId);
      expect(r2.asistencia.registrada).toBe(true);
      const filas = await db().selectFrom('marcaciones').select('id').where('evento_uuid', '=', evento).execute();
      expect(filas).toHaveLength(1);
      const asis = await asistenciaDe(alumno.matriculaId, esc.jornadaId);
      expect(asis).toHaveLength(1);
      expect(asis[0]).toMatchObject({ estado: 'tarde', entrada_id: r1.marcacionId });

      // El mismo UUID con otro tipo es otra marcación: la base lo rechaza.
      await esperarError(marcaciones.marcar(admin.actor, { eventoUuid: evento, tipo: 'salida', lectorId, codigo: token }), 'Conflict', /UUID/);

      // Salida con otro UUID: completa la asistencia con salida_id.
      const r3 = await marcaciones.marcar(admin.actor, { eventoUuid: randomUUID(), tipo: 'salida', lectorId, codigo: token });
      expect(r3.asistencia.registrada).toBe(true);
      const tras = await asistenciaDe(alumno.matriculaId, esc.jornadaId);
      expect(tras[0]).toMatchObject({ estado: 'tarde', entrada_id: r1.marcacionId, salida_id: r3.marcacionId });
    }));

  it('rechaza una credencial revocada (y no registra la marcación)', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId });
      const alumno = esc.alumnos[0]!;
      const { lectorId } = await crearLectorPrueba();
      const { token, credencialId } = await crearCredencialPrueba({ personaId: alumno.personaId, emitidaPor: admin.usuarioId });
      await credenciales.revocarCredencial(admin.actor, credencialId, 'Carnet extraviado');
      const evento = randomUUID();
      await esperarError(marcaciones.marcar(admin.actor, { eventoUuid: evento, tipo: 'entrada', lectorId, codigo: token }), 'Validation', /revocada/);
      expect(await db().selectFrom('marcaciones').select('id').where('evento_uuid', '=', evento).execute()).toHaveLength(0);
      await esperarError(credenciales.revocarCredencial(admin.actor, credencialId, 'Otra vez'), 'Validation', /ya estaba revocada/);
      // Un token inventado tampoco pasa; un lector inactivo tampoco.
      await esperarError(marcaciones.marcar(admin.actor, { eventoUuid: randomUUID(), tipo: 'entrada', lectorId, codigo: 'NOEXISTE1234567890AB' }), 'Validation', /Credencial/);
      const vigente = await crearCredencialPrueba({ personaId: alumno.personaId, emitidaPor: admin.usuarioId });
      const inactivo = await crearLectorPrueba(false);
      await esperarError(
        marcaciones.marcar(admin.actor, { eventoUuid: randomUUID(), tipo: 'entrada', lectorId: inactivo.lectorId, codigo: vigente.token }),
        'Validation',
        /lector/i,
      );
    }));

  it('exige el permiso asistencia.marcar (la base no lo verifica)', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId });
      const { lectorId } = await crearLectorPrueba();
      const { token } = await crearCredencialPrueba({ personaId: esc.alumnos[0]!.personaId, emitidaPor: admin.usuarioId });
      const docente = await crearUsuario({ roles: ['docente'] });
      await esperarError(
        marcaciones.marcar(await actorDe(docente), { eventoUuid: randomUUID(), tipo: 'entrada', lectorId, codigo: token }),
        'Forbidden',
      );
    }));

  it('sin jornada la marcación queda registrada y se informa el motivo', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      // Jornada mañana: hoy no hay jornada para la sección.
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, fecha: sumarDias(hoyLima(), 1) });
      const { lectorId } = await crearLectorPrueba();
      const { token } = await crearCredencialPrueba({ personaId: esc.alumnos[0]!.personaId, emitidaPor: admin.usuarioId });
      const r = await marcaciones.marcar(admin.actor, { eventoUuid: randomUUID(), tipo: 'entrada', lectorId, codigo: token });
      expect(r.asistencia.registrada).toBe(false);
      expect(r.asistencia.mensaje).toMatch(/jornada/);
      expect(await db().selectFrom('marcaciones').select('id').where('id', '=', r.marcacionId).execute()).toHaveLength(1);
    }));

  it('docente: la entrada crea su asistencia en su jornada', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const esc = await crearEscenarioDocente({ tolerancia: 0 });
      const { lectorId } = await crearLectorPrueba();
      const { token } = await crearCredencialPrueba({ personaId: esc.personaId, emitidaPor: admin.usuarioId });
      const r = await marcaciones.marcar(admin.actor, { eventoUuid: randomUUID(), tipo: 'entrada', lectorId, codigo: token });
      expect(r.persona.perfil).toBe('docente');
      expect(r.asistencia).toMatchObject({ registrada: true, estado: 'tarde' });
      const a = await db().selectFrom('asistencia_docentes').select(['estado', 'entrada_id']).where('jornada_id', '=', esc.jornadaId).executeTakeFirstOrThrow();
      expect(a).toEqual({ estado: 'tarde', entrada_id: r.marcacionId });
    }));
});

describe('sincronización offline (modo manual con la hora capturada)', () => {
  it('entrada crea presente/tarde según la tolerancia, con el instante capturado y motivo del lector', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const ayer = sumarDias(hoyLima(), -1);
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, alumnos: 3, fecha: ayer, entrada: '08:00', salida: '13:00', tolerancia: 10 });
      const { lectorId, codigo } = await crearLectorPrueba();
      const tokens = [];
      for (const a of esc.alumnos) tokens.push((await crearCredencialPrueba({ personaId: a.personaId, emitidaPor: admin.usuarioId })).token);
      const eventos = [
        { eventoUuid: randomUUID(), tipo: 'entrada' as const, lectorId, codigo: tokens[0]!, capturadoEn: instanteLima(ayer, '07:55:00.000') },
        { eventoUuid: randomUUID(), tipo: 'entrada' as const, lectorId, codigo: tokens[1]!, capturadoEn: instanteLima(ayer, '08:10:00.000') },
        { eventoUuid: randomUUID(), tipo: 'entrada' as const, lectorId, codigo: tokens[2]!, capturadoEn: instanteLima(ayer, '08:10:00.001') },
      ];
      const { resultados } = await marcaciones.sincronizar(admin.actor, eventos);
      expect(resultados.map((r) => r.ok)).toEqual([true, true, true]);
      expect(resultados.map((r) => r.resultado?.asistencia.estado)).toEqual(['presente', 'presente', 'tarde']);

      const m = await db()
        .selectFrom('marcaciones')
        .select(['metodo', 'instante', 'lector_id', 'credencial_id', 'motivo', 'persona_id'])
        .where('evento_uuid', '=', eventos[2]!.eventoUuid)
        .executeTakeFirstOrThrow();
      expect(m).toMatchObject({ metodo: 'manual', lector_id: null, credencial_id: null, persona_id: esc.alumnos[2]!.personaId });
      expect(m.motivo).toBe(`Lectura QR sin conexión en lector ${codigo}`);
      expect(m.instante.toISOString()).toBe(new Date(eventos[2]!.capturadoEn).toISOString());

      for (const [i, estado] of (['presente', 'presente', 'tarde'] as const).entries()) {
        const a = await asistenciaDe(esc.alumnos[i]!.matriculaId, esc.jornadaId);
        expect(a[0]?.estado).toBe(estado);
        expect(a[0]?.entrada_id).toBe(resultados[i]!.resultado?.marcacionId);
      }

      // Reintentar el mismo lote (p. ej. se perdió la respuesta) no duplica nada.
      const otra = await marcaciones.sincronizar(admin.actor, eventos);
      expect(otra.resultados.every((r) => r.ok)).toBe(true);
      expect(otra.resultados.map((r) => r.resultado?.marcacionId)).toEqual(resultados.map((r) => r.resultado?.marcacionId));

      // Salida offline completa la asistencia.
      const salida = await marcaciones.sincronizar(admin.actor, [
        { eventoUuid: randomUUID(), tipo: 'salida', lectorId, codigo: tokens[0]!, capturadoEn: instanteLima(ayer, '13:05:00.000') },
      ]);
      expect(salida.resultados[0]?.ok).toBe(true);
      const conSalida = await asistenciaDe(esc.alumnos[0]!.matriculaId, esc.jornadaId);
      expect(conSalida[0]?.salida_id).toBe(salida.resultados[0]?.resultado?.marcacionId);
    }));

  it('rechaza instantes futuros, de más de 7 días y credenciales no vigentes al capturar', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId });
      const { lectorId } = await crearLectorPrueba();
      const persona = esc.alumnos[0]!.personaId;
      const { token } = await crearCredencialPrueba({ personaId: persona, emitidaPor: admin.usuarioId, emitidaHaceDias: 3 });
      const base = { tipo: 'entrada' as const, lectorId, codigo: token };
      const futuro = new Date(Date.now() + 10 * 60_000).toISOString();
      const viejo = new Date(Date.now() - 8 * 86_400_000).toISOString();
      const antesDeEmitir = new Date(Date.now() - 5 * 86_400_000).toISOString();
      const { resultados } = await marcaciones.sincronizar(admin.actor, [
        { ...base, eventoUuid: randomUUID(), capturadoEn: futuro },
        { ...base, eventoUuid: randomUUID(), capturadoEn: viejo },
        { ...base, eventoUuid: randomUUID(), capturadoEn: antesDeEmitir },
      ]);
      expect(resultados.map((r) => r.ok)).toEqual([false, false, false]);
      expect(resultados.every((r) => r.definitivo)).toBe(true);
      expect(resultados[0]?.error).toMatch(/futura/);
      expect(resultados[1]?.error).toMatch(/7 días/);
      expect(resultados[2]?.error).toMatch(/Credencial/);
    }));

  it('si la política no admite manual, la marcación offline queda registrada pero no la asistencia', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const ayer = sumarDias(hoyLima(), -1);
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, fecha: ayer, entrada: '08:00', salida: '13:00', admiteManual: false });
      const { lectorId } = await crearLectorPrueba();
      const { token } = await crearCredencialPrueba({ personaId: esc.alumnos[0]!.personaId, emitidaPor: admin.usuarioId });
      const { resultados } = await marcaciones.sincronizar(admin.actor, [
        { eventoUuid: randomUUID(), tipo: 'entrada', lectorId, codigo: token, capturadoEn: instanteLima(ayer, '07:50:00') },
      ]);
      expect(resultados[0]?.ok).toBe(true);
      expect(resultados[0]?.resultado?.asistencia).toMatchObject({ registrada: false });
      expect(resultados[0]?.resultado?.asistencia.mensaje).toMatch(/no corresponde a la jornada/);
      expect(await asistenciaDe(esc.alumnos[0]!.matriculaId, esc.jornadaId)).toHaveLength(0);
    }));
});
