// Esquema de `reglas_evaluacion.criterios` (jsonb) y su evaluador puro (compartido cliente/servidor).
//
// La base solo exige que `criterios` sea un objeto JSON no vacío y NO decide la situación final
// (docs/db/discrepancias.md punto 18): la app aplica estos criterios para SUGERIR la situación y la base
// verifica la coherencia del cierre anual al aprobarlo. Documentado en docs/normativa.md.
//
// Modelo:
//  - `reglas` se evalúan EN ORDEN; la primera cuyas condiciones se cumplen fija la situación sugerida.
//  - Si ninguna se cumple se usa `situacionPorDefecto`.
//  - Cada condición cuenta competencias (o áreas) cuyo nivel de logro anual está en `niveles` y compara
//    esa cantidad con un umbral absoluto (`cantidad`) o relativo al total (`proporcion`, 0..1).
//  - Con ámbito 'areas', un área "cuenta" cuando la proporción de SUS competencias en `niveles`
//    cumple `umbralArea` (p. ej. más de la mitad).
//  - Si la situación es 'recuperacion', las competencias con nivel en `recuperacion.nivelesPendientes`
//    quedan marcadas como pendientes (requiere_recuperacion).
//  - En la etapa de recuperación, si los criterios vuelven a dar 'recuperacion' se sugiere
//    `recuperacion.situacionSiPersiste`.
import { z } from 'zod';
import { NIVELES_LOGRO, type NivelLogro } from '../comunes';

export const SITUACIONES = ['promovido', 'recuperacion', 'permanencia'] as const;
export type Situacion = (typeof SITUACIONES)[number];

export const ETIQUETA_SITUACION: Record<Situacion, string> = {
  promovido: 'Promovido',
  recuperacion: 'Requiere recuperación',
  permanencia: 'Permanece en el grado',
};

export const IDENTIFICADOR_ESQUEMA = 'seruna/criterios-evaluacion@1' as const;

const COMPARADORES = ['al_menos', 'mas_de', 'como_maximo', 'menos_de'] as const;
export type Comparador = (typeof COMPARADORES)[number];

export const ETIQUETA_COMPARADOR: Record<Comparador, string> = {
  al_menos: 'al menos',
  mas_de: 'más de',
  como_maximo: 'como máximo',
  menos_de: 'menos de',
};

const nivel = z.enum(NIVELES_LOGRO);

export const esquemaCondicion = z
  .object({
    ambito: z.enum(['competencias', 'areas']),
    niveles: z.array(nivel).min(1, 'Indique al menos un nivel'),
    comparador: z.enum(COMPARADORES),
    cantidad: z.number().int().min(0).optional(),
    proporcion: z.number().min(0).max(1).optional(),
    umbralArea: z
      .object({ comparador: z.enum(['al_menos', 'mas_de']), proporcion: z.number().gt(0).max(1) })
      .optional(),
    descripcion: z.string().trim().max(300).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if ((c.cantidad === undefined) === (c.proporcion === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Indique "cantidad" o "proporcion" (solo uno)', path: ['cantidad'] });
    }
    if (c.ambito === 'areas' && !c.umbralArea) {
      ctx.addIssue({ code: 'custom', message: 'Con ámbito "areas" indique "umbralArea"', path: ['umbralArea'] });
    }
  });

export const esquemaReglaSituacion = z
  .object({
    situacion: z.enum(SITUACIONES),
    descripcion: z.string().trim().min(1, 'Describa la regla').max(500),
    combinar: z.enum(['todas', 'alguna']).default('todas'),
    condiciones: z.array(esquemaCondicion).min(1).max(10),
  })
  .strict();

export const esquemaCriterios = z
  .object({
    esquema: z.literal(IDENTIFICADOR_ESQUEMA),
    descripcion: z.string().trim().max(1000).optional(),
    /** Códigos de áreas curriculares que no se consideran (p. ej. talleres). */
    areasExcluidas: z.array(z.string().trim().min(1)).max(50).default([]),
    reglas: z.array(esquemaReglaSituacion).max(20),
    situacionPorDefecto: z.enum(SITUACIONES).default('promovido'),
    recuperacion: z
      .object({
        nivelesPendientes: z.array(nivel).min(1),
        situacionSiPersiste: z.enum(['permanencia', 'recuperacion']).default('permanencia'),
      })
      .strict(),
  })
  .strict();

export type Criterios = z.infer<typeof esquemaCriterios>;
export type CondicionCriterio = z.infer<typeof esquemaCondicion>;

/**
 * Plantilla ILUSTRATIVA para empezar a redactar una regla. NO es la transcripción de una norma:
 * los umbrales deben verificarse contra el texto oficial vigente (docs/normativa.md) antes de aprobar.
 */
export const CRITERIOS_EJEMPLO: Criterios = {
  esquema: IDENTIFICADOR_ESQUEMA,
  descripcion: 'EJEMPLO ilustrativo: ajuste los umbrales al texto oficial vigente antes de aprobar.',
  areasExcluidas: [],
  reglas: [
    {
      situacion: 'permanencia',
      descripcion: 'Ejemplo: nivel C en más de la mitad de las competencias de 4 o más áreas',
      combinar: 'todas',
      condiciones: [
        { ambito: 'areas', niveles: ['C'], umbralArea: { comparador: 'mas_de', proporcion: 0.5 }, comparador: 'al_menos', cantidad: 4 },
      ],
    },
    {
      situacion: 'recuperacion',
      descripcion: 'Ejemplo: al menos una competencia en nivel C',
      combinar: 'todas',
      condiciones: [{ ambito: 'competencias', niveles: ['C'], comparador: 'al_menos', cantidad: 1 }],
    },
  ],
  situacionPorDefecto: 'promovido',
  recuperacion: { nivelesPendientes: ['C'], situacionSiPersiste: 'permanencia' },
};

export interface ResultadoParaCriterio {
  competenciaId: string;
  areaCodigo: string | null;
  nivel: NivelLogro;
}

export interface EvaluacionCriterios {
  situacion: Situacion;
  /** Descripción de la regla aplicada (null = situación por defecto). */
  regla: string | null;
  /** Competencias que quedarían pendientes de recuperación. */
  pendientes: string[];
  /** Explicación legible de cada condición evaluada. */
  detalle: string[];
}

function comparar(valor: number, comparador: Comparador, umbral: number): boolean {
  switch (comparador) {
    case 'al_menos':
      return valor >= umbral;
    case 'mas_de':
      return valor > umbral;
    case 'como_maximo':
      return valor <= umbral;
    case 'menos_de':
      return valor < umbral;
  }
}

function evaluarCondicion(c: CondicionCriterio, resultados: ResultadoParaCriterio[]): { cumple: boolean; texto: string } {
  const enNiveles = (r: ResultadoParaCriterio) => c.niveles.includes(r.nivel);
  let cantidad: number;
  let total: number;
  if (c.ambito === 'competencias') {
    cantidad = resultados.filter(enNiveles).length;
    total = resultados.length;
  } else {
    const porArea = new Map<string, ResultadoParaCriterio[]>();
    for (const r of resultados) {
      const clave = r.areaCodigo ?? '(sin área)';
      porArea.set(clave, [...(porArea.get(clave) ?? []), r]);
    }
    const umbral = c.umbralArea ?? { comparador: 'mas_de' as const, proporcion: 0.5 };
    cantidad = [...porArea.values()].filter((lista) => comparar(lista.filter(enNiveles).length / lista.length, umbral.comparador, umbral.proporcion)).length;
    total = porArea.size;
  }
  const limite = c.cantidad ?? (c.proporcion ?? 0) * total;
  const cumple = comparar(cantidad, c.comparador, limite);
  const unidad = c.ambito === 'competencias' ? 'competencias' : 'áreas';
  const umbralTexto = c.cantidad !== undefined ? String(c.cantidad) : `${Math.round((c.proporcion ?? 0) * 100)} % de ${total}`;
  return {
    cumple,
    texto: `${cantidad} de ${total} ${unidad} en ${c.niveles.join('/')} (${ETIQUETA_COMPARADOR[c.comparador]} ${umbralTexto}): ${cumple ? 'se cumple' : 'no se cumple'}`,
  };
}

/** Aplica los criterios a los resultados anuales y sugiere la situación final. Función pura. */
export function evaluarCriterios(
  criterios: Criterios,
  resultadosTodos: ResultadoParaCriterio[],
  opciones: { etapa: 'ordinario' | 'rectificacion' | 'recuperacion' } = { etapa: 'ordinario' },
): EvaluacionCriterios {
  const excluidas = new Set(criterios.areasExcluidas);
  const resultados = resultadosTodos.filter((r) => !r.areaCodigo || !excluidas.has(r.areaCodigo));
  const detalle: string[] = [];
  let situacion: Situacion = criterios.situacionPorDefecto;
  let regla: string | null = null;
  for (const r of criterios.reglas) {
    const evaluadas = r.condiciones.map((c) => evaluarCondicion(c, resultados));
    detalle.push(...evaluadas.map((e) => `${r.descripcion} → ${e.texto}`));
    const cumple = r.combinar === 'todas' ? evaluadas.every((e) => e.cumple) : evaluadas.some((e) => e.cumple);
    if (cumple) {
      situacion = r.situacion;
      regla = r.descripcion;
      break;
    }
  }
  if (opciones.etapa === 'recuperacion' && situacion === 'recuperacion') {
    situacion = criterios.recuperacion.situacionSiPersiste;
    detalle.push(`Tras la recuperación persiste la condición: se sugiere "${ETIQUETA_SITUACION[situacion]}"`);
  }
  const pendientes =
    situacion === 'recuperacion' ? resultados.filter((r) => criterios.recuperacion.nivelesPendientes.includes(r.nivel)).map((r) => r.competenciaId) : [];
  return { situacion, regla, pendientes, detalle };
}

/** Valida un JSON arbitrario (p. ej. el guardado en la base) contra el esquema. */
export function leerCriterios(valor: unknown): { ok: true; criterios: Criterios } | { ok: false; error: string } {
  const r = esquemaCriterios.safeParse(valor);
  if (r.success) return { ok: true, criterios: r.data };
  const p = r.error.issues[0];
  return { ok: false, error: p ? `${p.path.join('.') || 'criterios'}: ${p.message}` : 'Criterios inválidos' };
}
