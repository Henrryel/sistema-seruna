import 'server-only';
import { sql } from '@/server/db';

// Fragmentos SQL reutilizados por los repositorios de cobros.

export const HOY_LIMA = sql<string>`(now() at time zone 'America/Lima')::date`;

/** Texto del grado ("3.º Primaria") con alias `g` (grados) y `n` (niveles). */
export const GRADO_TEXTO = sql<string>`(g.numero || '.º ' || n.nombre)`;

/** Nombre de la sección más reciente de la matrícula (alias de la matrícula por defecto `m`). */
export function seccionActual(aliasMatricula = 'm') {
  return sql<string | null>`(select s.nombre from matricula_secciones ms join secciones s on s.id = ms.seccion_id where ms.matricula_id = ${sql.ref(`${aliasMatricula}.id`)} order by lower(ms.vigencia) desc limit 1)`;
}

/** Id de la sección más reciente de la matrícula. */
export function seccionActualId(aliasMatricula = 'm') {
  return sql<string | null>`(select ms.seccion_id from matricula_secciones ms where ms.matricula_id = ${sql.ref(`${aliasMatricula}.id`)} order by lower(ms.vigencia) desc limit 1)`;
}

/** "Apellidos, Nombres" con alias de personas (por defecto `pe`). */
export function nombreAlumno(aliasPersona = 'pe') {
  return sql<string>`(${sql.ref(`${aliasPersona}.apellidos`)} || ', ' || ${sql.ref(`${aliasPersona}.nombres`)})`;
}

/** Medio tal como se muestra (Yape/Plin se reconocen por la referencia). Alias de pagos por defecto `p`. */
export function medioUi(aliasPago = 'p') {
  const medio = sql.ref(`${aliasPago}.medio`);
  const ref = sql.ref(`${aliasPago}.referencia`);
  return sql<string>`(case when ${medio} = 'transferencia' and ${ref} ilike 'yape:%' then 'yape' when ${medio} = 'transferencia' and ${ref} ilike 'plin:%' then 'plin' else ${medio} end)`;
}

/** Orden natural de conceptos: ingreso, matrícula, pensión. */
export function ordenConcepto(columna: string) {
  return sql<number>`(case ${sql.ref(columna)} when 'ingreso' then 1 when 'matricula' then 2 else 3 end)`;
}

export const aIso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
