import 'server-only';
import { sql } from '@/server/db';
import { leerRangoFechas } from '@/lib/formato';

// Fragmentos SQL reutilizados por los repositorios académicos de este módulo.

export const HOY_LIMA = sql<string>`(now() at time zone 'America/Lima')::date`;

/** Etiqueta legible de una sección: "1.º A · Primaria" (requiere alias s, g, n). */
export const ETIQUETA_SECCION = sql<string>`g.numero || '.º ' || s.nombre || ' · ' || n.nombre`;

/** Etiqueta del grado: "1.º Primaria" (requiere alias g, n). */
export const ETIQUETA_GRADO = sql<string>`g.numero || '.º ' || n.nombre`;

/** Nombre completo del docente (requiere alias pd para su persona). */
export const NOMBRE_DOCENTE = sql<string>`pd.apellidos || ', ' || pd.nombres`;

/** daterange → { inicio, fin } (fin inclusivo). */
export function vigencia(rango: string | null | undefined) {
  return leerRangoFechas(rango);
}

/** Literal daterange cerrado '[inicio,fin]'. */
export function rango(inicio: string, fin: string) {
  return `[${inicio},${fin}]`;
}
