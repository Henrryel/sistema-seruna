// Fixtures del módulo de asistencia. Usar SIEMPRE dentro de enPrueba() (todo se revierte).
import { randomInt } from 'node:crypto';
import { db, sql } from '@/server/db';
import { hashToken } from '@/server/auth/tokens';
import { generarTokenCredencial } from '@/server/asistencia/tokens';
import { hoyLima, sumarDias } from '@/lib/formato';
import { crearDocente, crearEstudiante, crearReglaMatricula, crearSeccion, gradoId, sufijo } from './base';

/** Año académico que contiene hoy (±dias). El número de año es aleatorio para no chocar con otros datos. */
export async function crearAnioVigente(dias = 60) {
  const hoy = hoyLima();
  const inicio = sumarDias(hoy, -dias);
  const fin = sumarDias(hoy, dias);
  const anio = 2000 + randomInt(25);
  const a = await db().insertInto('anios_academicos').values({ anio, inicio, fin, estado: 'abierto' }).returning(['id']).executeTakeFirstOrThrow();
  return { anioId: a.id, anio, inicio, fin, bimestres: [] as { id: string; numero: number; inicio: string; fin: string }[] };
}

export async function crearPoliticaPrueba(opciones: {
  anioId: string;
  alcance: 'alumno' | 'docente';
  inicio: string;
  fin: string;
  tolerancia?: number;
  admiteQr?: boolean;
  admiteManual?: boolean;
  ventanaEntrada?: number;
  ventanaSalida?: number;
}) {
  return db()
    .insertInto('politicas_asistencia')
    .values({
      anio_id: opciones.anioId,
      alcance: opciones.alcance,
      turno: `Prueba ${sufijo()}`,
      vigencia: `[${opciones.inicio},${opciones.fin}]`,
      admite_qr: opciones.admiteQr ?? true,
      admite_manual: opciones.admiteManual ?? true,
      tolerancia_minutos: opciones.tolerancia ?? 10,
      ventana_entrada_minutos: opciones.ventanaEntrada ?? 120,
      ventana_salida_minutos: opciones.ventanaSalida ?? 120,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/**
 * Sección con `alumnos` matriculados (matrícula activa y confirmada durante todo el año), una política de
 * alumnos y una jornada programada en `fecha` (por defecto hoy) con el horario indicado.
 */
export async function crearEscenarioAlumnos(opciones: {
  registradoPor: string;
  alumnos?: number;
  fecha?: string;
  entrada?: string;
  salida?: string;
  tolerancia?: number;
  admiteQr?: boolean;
  admiteManual?: boolean;
}) {
  const anio = await crearAnioVigente();
  const politica = await crearPoliticaPrueba({
    anioId: anio.anioId,
    alcance: 'alumno',
    inicio: anio.inicio,
    fin: anio.fin,
    tolerancia: opciones.tolerancia,
    admiteQr: opciones.admiteQr,
    admiteManual: opciones.admiteManual,
  });
  const grado = await gradoId('primaria', 1);
  const seccion = await crearSeccion(anio.anioId, grado, { nombre: `Z${randomInt(100_000)}` });
  const regla = await crearReglaMatricula(anio.anioId, grado);
  const alumnos: { estudianteId: string; personaId: string; matriculaId: string; matriculaSeccionId: string }[] = [];
  for (let i = 0; i < (opciones.alumnos ?? 1); i++) {
    const e = await crearEstudiante();
    const m = await db()
      .insertInto('matriculas')
      .values({
        estudiante_id: e.estudianteId,
        anio_id: anio.anioId,
        grado_id: grado,
        regla_id: regla.id,
        tipo_ingreso: 'nuevo',
        estado: 'activa',
        confirmada_en: sql`now()`,
        registrado_por: opciones.registradoPor,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    const ms = await db()
      .insertInto('matricula_secciones')
      .values({
        matricula_id: m.id,
        seccion_id: seccion.id,
        anio_id: anio.anioId,
        grado_id: grado,
        vigencia: `[${anio.inicio},${anio.fin}]`,
        registrado_por: opciones.registradoPor,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    alumnos.push({ ...e, matriculaId: m.id, matriculaSeccionId: ms.id });
  }
  const jornada = await crearJornadaSeccion({
    seccionId: seccion.id,
    anioId: anio.anioId,
    gradoId: grado,
    politicaId: politica.id,
    fecha: opciones.fecha ?? hoyLima(),
    entrada: opciones.entrada ?? '00:00',
    salida: opciones.salida ?? '23:59:59',
  });
  return { anio, politicaId: politica.id, gradoId: grado, seccionId: seccion.id, jornadaId: jornada.id, alumnos };
}

export async function crearJornadaSeccion(j: { seccionId: string; anioId: string; gradoId: string; politicaId: string; fecha: string; entrada: string; salida: string }) {
  return db()
    .insertInto('jornadas_seccion')
    .values({ seccion_id: j.seccionId, anio_id: j.anioId, grado_id: j.gradoId, politica_id: j.politicaId, fecha: j.fecha, entrada: j.entrada, salida: j.salida })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

/** Docente activo con política docente y una jornada en `fecha`. */
export async function crearEscenarioDocente(opciones: { personaId?: string; fecha?: string; entrada?: string; salida?: string; tolerancia?: number } = {}) {
  const anio = await crearAnioVigente();
  const politica = await crearPoliticaPrueba({ anioId: anio.anioId, alcance: 'docente', inicio: anio.inicio, fin: anio.fin, tolerancia: opciones.tolerancia });
  const docente = await crearDocente({ personaId: opciones.personaId });
  const jornada = await db()
    .insertInto('jornadas_docente')
    .values({
      docente_id: docente.docenteId,
      anio_id: anio.anioId,
      politica_id: politica.id,
      fecha: opciones.fecha ?? hoyLima(),
      entrada: opciones.entrada ?? '00:00',
      salida: opciones.salida ?? '23:59:59',
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return { anio, politicaId: politica.id, ...docente, jornadaId: jornada.id };
}

export async function crearLectorPrueba(activo = true) {
  const codigo = `LQ-${sufijo()}`.toUpperCase();
  const l = await db().insertInto('lectores_qr').values({ codigo, nombre: 'Puerta de prueba', activo }).returning(['id']).executeTakeFirstOrThrow();
  return { lectorId: l.id, codigo };
}

/**
 * Credencial con token conocido (solo el hash va a la base). Por defecto emitida hace 10 días y vigente
 * 30 días más, para poder probar lecturas offline capturadas en el pasado.
 */
export async function crearCredencialPrueba(opciones: { personaId: string; emitidaPor: string; emitidaHaceDias?: number; venceEnDias?: number }) {
  const token = generarTokenCredencial();
  const c = await db()
    .insertInto('credenciales_qr')
    .values({
      persona_id: opciones.personaId,
      token_hash: hashToken(token),
      emitida_por: opciones.emitidaPor,
      emitida_en: sql<Date>`now() - make_interval(days => ${opciones.emitidaHaceDias ?? 10})`,
      expira_en: sql<Date>`now() + make_interval(days => ${opciones.venceEnDias ?? 30})`,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return { credencialId: c.id, token };
}

/** Instante ISO con zona de Lima (-05:00, sin horario de verano) para una fecha y hora locales. */
export function instanteLima(fecha: string, hora: string): string {
  return `${fecha}T${hora}-05:00`;
}
