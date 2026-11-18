import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db, sql } from '@/server/db';
import * as configuracion from '@/server/services/asistencia/configuracion';
import * as credenciales from '@/server/services/asistencia/credenciales';
import * as registro from '@/server/services/asistencia/registro';
import * as marcaciones from '@/server/services/asistencia/marcaciones';
import { hashToken } from '@/server/auth/tokens';
import { responderDiaria } from '@/server/asistencia/http';
import { generarTokenCredencial, LONGITUD_TOKEN, normalizarCodigoLeido } from '@/server/asistencia/tokens';
import { hoyLima, sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearDocente, crearSeccion, crearUsuario, gradoId } from '@tests/fixtures/base';
import { crearAnioVigente, crearEscenarioAlumnos, crearLectorPrueba } from '@tests/fixtures/asistencia';

/** Primer lunes en o después de la fecha. */
function lunesDesde(fecha: string) {
  let f = fecha;
  while (new Date(`${f}T12:00:00Z`).getUTCDay() !== 1) f = sumarDias(f, 1);
  return f;
}

describe('tokens de credencial', () => {
  it('alfanuméricos en mayúsculas, aptos para QR y Code 128', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = generarTokenCredencial();
      expect(t).toMatch(new RegExp(`^[0-9A-HJKMNP-TV-Z]{${LONGITUD_TOKEN}}$`));
      vistos.add(t);
    }
    expect(vistos.size).toBe(200);
    expect(normalizarCodigoLeido(' ab-12\r\n')).toBe('AB12');
  });
});

describe('políticas y jornadas', () => {
  it('genera jornadas de sección lunes a viernes sin duplicar; con calendario usa solo días lectivos', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnioVigente(40);
      const pol = await configuracion.crearPolitica(admin.actor, {
        anioId: anio.anioId,
        alcance: 'alumno',
        turno: `Mañana ${randomUUID().slice(0, 6)}`,
        vigenciaInicio: anio.inicio,
        vigenciaFin: anio.fin,
        admiteQr: true,
        admiteManual: true,
        toleranciaMinutos: 10,
        ventanaEntradaMinutos: 60,
        ventanaSalidaMinutos: 60,
      });
      const grado = await gradoId('primaria', 2);
      const s1 = await crearSeccion(anio.anioId, grado, { nombre: 'Q1' });
      const s2 = await crearSeccion(anio.anioId, grado, { nombre: 'Q2' });
      const desde = lunesDesde(anio.inicio);
      const hasta = sumarDias(desde, 13); // dos semanas → 10 días hábiles
      const datos = { tipo: 'seccion' as const, politicaId: pol.id, desde, hasta, entrada: '07:45', salida: '13:00', seccionIds: [s1.id, s2.id], docenteIds: [] };
      const r = await configuracion.generarJornadas(admin.actor, datos);
      expect(r).toEqual({ fechas: 10, creadas: 20, omitidas: 0, fuente: 'lunes-viernes' });
      const again = await configuracion.generarJornadas(admin.actor, datos);
      expect(again).toMatchObject({ creadas: 0, omitidas: 20 });

      // Con días lectivos en el calendario, solo esos (aunque caigan en sábado).
      const sabado = sumarDias(desde, 19);
      await db()
        .insertInto('calendario_escolar')
        .values([
          { anio_id: anio.anioId, fecha: sumarDias(desde, 14), tipo: 'lectivo' },
          { anio_id: anio.anioId, fecha: sabado, tipo: 'lectivo' },
          { anio_id: anio.anioId, fecha: sumarDias(desde, 15), tipo: 'feriado' },
        ])
        .execute();
      const conCal = await configuracion.generarJornadas(admin.actor, { ...datos, desde: sumarDias(desde, 14), hasta: sumarDias(desde, 20), seccionIds: [s1.id] });
      expect(conCal).toEqual({ fechas: 2, creadas: 2, omitidas: 0, fuente: 'calendario' });

      // Una política de alumnos no sirve para docentes.
      await esperarError(configuracion.generarJornadas(admin.actor, { ...datos, tipo: 'docente', docenteIds: ['1'] }), 'Validation', /docente/);

      // Cancelar: queda fuera de la vista diaria.
      const lista = await configuracion.listarJornadas({ tipo: 'seccion', anioId: anio.anioId }, null);
      expect(lista.total).toBe(22);
      const j = lista.filas[0]!;
      await configuracion.cancelarJornada(admin.actor, 'seccion', j.id, 'Suspensión de clases');
      await esperarError(configuracion.cancelarJornada(admin.actor, 'seccion', j.id, 'Otra vez'), 'Validation', /cancelada/);
    }));

  it('jornadas docentes: omite solapes con otra jornada programada', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnioVigente(40);
      const pol = await configuracion.crearPolitica(admin.actor, {
        anioId: anio.anioId,
        alcance: 'docente',
        turno: `Docentes ${randomUUID().slice(0, 6)}`,
        vigenciaInicio: anio.inicio,
        vigenciaFin: anio.fin,
        admiteQr: true,
        admiteManual: false,
        toleranciaMinutos: 5,
        ventanaEntradaMinutos: 60,
        ventanaSalidaMinutos: 60,
      });
      const d = await crearDocente();
      const desde = lunesDesde(anio.inicio);
      const base = { tipo: 'docente' as const, politicaId: pol.id, desde, hasta: sumarDias(desde, 4), seccionIds: [], docenteIds: [d.docenteId] };
      expect((await configuracion.generarJornadas(admin.actor, { ...base, entrada: '07:30', salida: '13:30' })).creadas).toBe(5);
      expect((await configuracion.generarJornadas(admin.actor, { ...base, entrada: '13:00', salida: '18:00' })).creadas).toBe(0);
      expect((await configuracion.generarJornadas(admin.actor, { ...base, entrada: '14:00', salida: '18:00' })).creadas).toBe(5);
    }));
});

describe('credenciales y carnets', () => {
  it('emite por sección: PDF con carnets, la base guarda solo el hash; reemitir revoca la anterior', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, alumnos: 3 });
      const expira = sumarDias(hoyLima(), 30);
      const r = await credenciales.emitirCredenciales(admin.actor, { modo: 'seccion', seccionId: esc.seccionId, personaIds: [], docenteIds: [], expiraEn: expira });
      expect(r.emitidas).toHaveLength(3);
      expect(r.pdf.subarray(0, 5).toString()).toBe('%PDF-');
      const guardadas = await db()
        .selectFrom('credenciales_qr')
        .select(['id', 'token_hash', sql<number>`octet_length(token_hash)`.as('bytes'), sql<string>`(expira_en at time zone 'America/Lima')::text`.as('vence')])
        .where('id', 'in', r.emitidas.map((e) => e.credencialId))
        .execute();
      for (const e of r.emitidas) {
        const g = guardadas.find((x) => x.id === e.credencialId)!;
        expect(g.bytes).toBe(32);
        expect(g.token_hash.equals(hashToken(e.token))).toBe(true);
        expect(g.token_hash.toString('utf8')).not.toContain(e.token);
        expect(g.vence).toBe(`${sumarDias(expira, 1)} 00:00:00`);
      }
      // Reimprimir = reemitir: la anterior queda revocada y deja de marcar; la nueva sí marca.
      const persona = esc.alumnos[0]!.personaId;
      const anterior = r.emitidas.find((e) => e.personaId === persona)!;
      const r2 = await credenciales.emitirCredenciales(admin.actor, { modo: 'personas', personaIds: [persona], docenteIds: [], expiraEn: expira });
      expect(r2.revocadas).toBe(1);
      const { lectorId } = await crearLectorPrueba();
      await esperarError(marcaciones.marcar(admin.actor, { eventoUuid: randomUUID(), tipo: 'entrada', lectorId, codigo: anterior.token }), 'Validation', /revocada/);
      const ok = await marcaciones.marcar(admin.actor, { eventoUuid: randomUUID(), tipo: 'entrada', lectorId, codigo: r2.emitidas[0]!.token });
      expect(ok.persona.id).toBe(persona);
      expect(ok.asistencia.registrada).toBe(true);

      const lista = await credenciales.listarCredenciales({ estado: 'revocada' }, { limite: 50, desplazamiento: 0 });
      expect(lista.filas.map((f) => f.id)).toContain(anterior.credencialId);
      await esperarError(
        credenciales.emitirCredenciales(admin.actor, { modo: 'personas', personaIds: [persona], docenteIds: [], expiraEn: sumarDias(hoyLima(), -1) }),
        'Validation',
        /vencimiento/,
      );
    }));
});

describe('registro manual de asistencia', () => {
  it('admin registra y corrige; la base rechaza lo incoherente y el docente solo ve sus secciones', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const ayer = sumarDias(hoyLima(), -1);
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, alumnos: 2, fecha: ayer, entrada: '08:00', salida: '13:00' });
      const [a1, a2] = esc.alumnos as [(typeof esc.alumnos)[0], (typeof esc.alumnos)[0]];
      const lista = await registro.listarDiariaSeccion(admin.actor, { seccionId: esc.seccionId, fecha: ayer }, null, 'admin');
      expect(lista.total).toBe(2);
      expect(lista.filas.every((f) => f.estado === 'pendiente')).toBe(true);

      const r1 = await registro.registrarDiario(
        admin.actor,
        { jornadaId: esc.jornadaId, motivo: 'Lista del aula', registros: [{ matriculaId: a1.matriculaId, estado: 'presente' }, { matriculaId: a2.matriculaId, estado: 'tarde' }] },
        'admin',
      );
      expect(r1).toEqual({ guardados: 2, sinCambios: 0, errores: [] });
      const r2 = await registro.registrarDiario(
        admin.actor,
        { jornadaId: esc.jornadaId, motivo: 'Corrección', registros: [{ matriculaId: a1.matriculaId, estado: 'presente' }, { matriculaId: a2.matriculaId, estado: 'ausente' }] },
        'admin',
      );
      expect(r2).toEqual({ guardados: 1, sinCambios: 1, errores: [] });
      const tras = await registro.listarDiariaSeccion(admin.actor, { seccionId: esc.seccionId, fecha: ayer }, null, 'admin');
      expect(Object.fromEntries(tras.filas.map((f) => [f.matricula_id, f.estado]))).toEqual({ [a1.matriculaId]: 'presente', [a2.matriculaId]: 'ausente' });
      // Exportación con los mismos filtros (Excel y PDF) y JSON con la jornada.
      const base = { seccionId: esc.seccionId, fecha: ayer, pagina: 1, porPagina: 20, q: undefined };
      const json = await responderDiaria(admin.actor, { ...base, formato: 'json' }, 'admin');
      expect(json).toMatchObject({ total: 2, jornada: { id: esc.jornadaId } });
      for (const formato of ['xlsx', 'pdf'] as const) {
        const res = await responderDiaria(admin.actor, { ...base, formato }, 'admin');
        expect(res).toBeInstanceOf(Response);
        const bytes = Buffer.from(await (res as Response).arrayBuffer());
        expect(bytes.subarray(0, 2).toString()).toBe(formato === 'pdf' ? '%P' : 'PK');
      }
      // La bitácora la escribe la base (trigger auditar_asistencia) con el motivo.
      const bit = await db().selectFrom('bitacora').select(['motivo', 'resultado']).where('entidad', '=', 'asistencia_estudiantes').where('actor_id', '=', admin.usuarioId).execute();
      expect(bit.map((b) => b.resultado)).toContain('tarde → ausente');

      // Un alumno que no es de la sección: error por fila, el resto se guarda.
      const r3 = await registro.registrarDiario(
        admin.actor,
        { jornadaId: esc.jornadaId, motivo: 'Mixto', registros: [{ matriculaId: '999999999', estado: 'presente' }, { matriculaId: a2.matriculaId, estado: 'presente' }] },
        'admin',
      );
      expect(r3.guardados).toBe(1);
      expect(r3.errores[0]?.mensaje).toMatch(/no pertenece/);

      // Un docente sin la sección asignada no puede registrar ni ver.
      const doc = await crearUsuario({ roles: ['docente'] });
      await crearDocente({ personaId: doc.personaId });
      const actorDoc = await actorDe(doc);
      await esperarError(registro.listarDiariaSeccion(actorDoc, { seccionId: esc.seccionId, fecha: ayer }, null, 'docente'), 'Forbidden');
      await esperarError(
        registro.registrarDiario(actorDoc, { jornadaId: esc.jornadaId, motivo: 'x', registros: [{ matriculaId: a1.matriculaId, estado: 'ausente' }] }, 'docente'),
        'Forbidden',
      );
    }));

  it('con política sin manual, la presencia sin marcación la rechaza la base', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, fecha: sumarDias(hoyLima(), -1), admiteManual: false });
      const r = await registro.registrarDiario(
        admin.actor,
        { jornadaId: esc.jornadaId, motivo: 'Lista', registros: [{ matriculaId: esc.alumnos[0]!.matriculaId, estado: 'presente' }] },
        'admin',
      );
      expect(r.guardados).toBe(0);
      expect(r.errores[0]?.mensaje).toBe('La política exige una marcación para registrar presencia');
      // Ausente sí se puede (no requiere marcación).
      const r2 = await registro.registrarDiario(
        admin.actor,
        { jornadaId: esc.jornadaId, motivo: 'Lista', registros: [{ matriculaId: esc.alumnos[0]!.matriculaId, estado: 'ausente' }] },
        'admin',
      );
      expect(r2.guardados).toBe(1);
    }));
});
