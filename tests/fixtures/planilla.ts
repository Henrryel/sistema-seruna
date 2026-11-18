// Fixtures del módulo de planilla. Usar SIEMPRE dentro de enPrueba() (todo se revierte).
import { randomInt, randomUUID } from 'node:crypto';
import React from 'react';
import { db, sql } from '@/server/db';
import { crearAnio } from './base';

// Vitest transforma JSX con el runtime clásico (tsconfig "jsx": "preserve"), que exige `React` global para
// renderizar los PDF de react-pdf (src/server/pdf/**). Next usa el runtime automático y no lo necesita.
(globalThis as { React?: typeof React }).React ??= React;

/** Mes futuro aleatorio 'YYYY-MM' (periodos_liquidacion.mes es UNIQUE). */
export function mesFuturo(): string {
  return `${2101 + randomInt(98)}-${String(1 + randomInt(12)).padStart(2, '0')}`;
}

/** Mes pasado aleatorio 'YYYY-MM' (la base solo acepta horas ya trabajadas). */
export function mesPasado(): string {
  return `${2001 + randomInt(24)}-${String(1 + randomInt(12)).padStart(2, '0')}`;
}

export const finDeMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};

export async function crearContrato(o: {
  docenteId: string;
  registradoPor: string;
  modalidad: 'fijo' | 'por_horas';
  inicio: string;
  fin: string;
  sueldo?: string;
  tarifa?: string;
  minutosPorHora?: number;
}) {
  return db()
    .insertInto('contratos_docentes')
    .values({
      docente_id: o.docenteId,
      referencia: `CT-${randomUUID().slice(0, 8)}`,
      vigencia: `[${o.inicio},${o.fin}]`,
      modalidad: o.modalidad,
      sueldo_mensual: o.modalidad === 'fijo' ? (o.sueldo ?? '3000.00') : null,
      tarifa_hora: o.modalidad === 'por_horas' ? (o.tarifa ?? '30.0000') : null,
      minutos_por_hora: o.modalidad === 'por_horas' ? (o.minutosPorHora ?? 45) : null,
      registrado_por: o.registradoPor,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
}

export type EstadoDia = 'presente' | 'tarde' | 'justificado' | 'sin_registro';

/**
 * Año académico PASADO (las marcaciones no pueden ser futuras) con política docente y jornadas del docente
 * en los días indicados del mes; registra la asistencia con marcación manual de entrada.
 * 'justificado' = tardanza con justificación aprobada (la base la pasa a "justificado").
 */
export async function prepararAsistenciaDocente(o: {
  docenteId: string;
  personaId: string;
  registradoPor: string;
  anio: number;
  mes: number;
  dias: { dia: number; estado: EstadoDia; entrada?: string }[];
  tolerancia?: number;
  inicioJornada?: string;
  finJornada?: string;
}) {
  const anio = await crearAnio({ anio: o.anio });
  const politica = await db()
    .insertInto('politicas_asistencia')
    .values({
      anio_id: anio.anioId,
      alcance: 'docente',
      turno: 'Mañana',
      vigencia: `[${anio.inicio},${anio.fin}]`,
      tolerancia_minutos: o.tolerancia ?? 5,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  const mm = String(o.mes).padStart(2, '0');
  for (const d of o.dias) {
    const fecha = `${o.anio}-${mm}-${String(d.dia).padStart(2, '0')}`;
    const jornada = await db()
      .insertInto('jornadas_docente')
      .values({
        docente_id: o.docenteId,
        anio_id: anio.anioId,
        politica_id: politica.id,
        fecha,
        entrada: o.inicioJornada ?? '08:00',
        salida: o.finJornada ?? '13:00',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    if (d.estado === 'sin_registro') continue;
    const marcacion = await db()
      .insertInto('marcaciones')
      .values({
        evento_uuid: randomUUID(),
        persona_id: o.personaId,
        instante: `${fecha}T${d.entrada ?? '07:55'}:00-05:00`,
        tipo: 'entrada',
        metodo: 'manual',
        actor_id: o.registradoPor,
        motivo: 'Prueba de planilla',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    const asistencia = await db()
      .insertInto('asistencia_docentes')
      .values({
        jornada_id: jornada.id,
        estado: d.estado === 'justificado' ? 'tarde' : d.estado,
        entrada_id: marcacion.id,
        registrado_por: o.registradoPor,
        motivo: 'Marcación manual (prueba)',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    if (d.estado === 'justificado') {
      const j = await db()
        .insertInto('justificaciones_asistencia')
        .values({
          asistencia_docente_id: asistencia.id,
          solicitada_por: o.registradoPor,
          motivo: 'Cita médica',
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();
      await db()
        .updateTable('justificaciones_asistencia')
        .set({
          estado: 'aprobada',
          resuelta_por: o.registradoPor,
          resuelta_en: sql`clock_timestamp()`,
          decision: 'Sustentada',
        })
        .where('id', '=', j.id)
        .execute();
    }
  }
  return { anioId: anio.anioId, politicaId: politica.id };
}
