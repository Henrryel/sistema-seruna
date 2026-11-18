import 'server-only';
import { sql } from '@/server/db';

// Utilidades SQL compartidas por los repositorios de planilla.

export const HOY_LIMA = sql<string>`(now() at time zone 'America/Lima')::date`;

/** Patrón ILIKE con los comodines del usuario escapados. */
export function patron(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Fecha/hora de la base a ISO (o null). */
export function iso(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

export const isoRequerido = (v: Date | string): string => iso(v) as string;
