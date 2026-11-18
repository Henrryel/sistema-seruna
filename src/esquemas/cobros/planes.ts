import { z } from 'zod';
import { consultaListado, fecha, id, idOpcional, importe, importePositivo } from '../comunes';

export const CONCEPTOS = ['ingreso', 'matricula', 'pension'] as const;
export type Concepto = (typeof CONCEPTOS)[number];

export const ETIQUETA_CONCEPTO: Record<string, string> = {
  ingreso: 'Cuota de ingreso',
  matricula: 'Matrícula',
  pension: 'Pensión',
};

export const OPCIONES_CONCEPTO = CONCEPTOS.map((c) => ({ valor: c, etiqueta: ETIQUETA_CONCEPTO[c] ?? c }));

const importeNoNegativo = importe.refine((v) => Number(v) >= 0, 'El importe no puede ser negativo');

/** Mes 'AAAA-MM' (o 'AAAA-MM-01') → 'AAAA-MM-01'. */
const mes = z
  .string()
  .regex(/^\d{4}-\d{2}(-01)?$/, 'Mes inválido (AAAA-MM)')
  .transform((v) => `${v.slice(0, 7)}-01`);

export const esquemaPlan = z.object({
  anioId: id,
  gradoId: id,
  pensionReferencia: importePositivo,
  vigenteDesde: fecha,
  /** Documento 'condiciones_economicas' publicado del año. Si se omite, se toma el vigente del año. */
  condicionesId: idOpcional,
});
export type DatosPlan = z.infer<typeof esquemaPlan>;

export const esquemaEditarPlan = esquemaPlan.omit({ anioId: true, gradoId: true });
export type DatosEditarPlan = z.infer<typeof esquemaEditarPlan>;

export const esquemaTramo = z
  .object({
    concepto: z.enum(CONCEPTOS),
    numero: z.coerce.number().int().min(1, 'Mínimo 1').max(99),
    importe: importeNoNegativo,
    mesServicio: z
      .union([mes, z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    exigibleDesde: fecha,
    venceEn: fecha,
  })
  .refine((d) => d.venceEn >= d.exigibleDesde, { message: 'El vencimiento no puede ser anterior a la exigibilidad', path: ['venceEn'] })
  .refine((d) => (d.concepto === 'pension') === (d.mesServicio !== null), {
    message: 'Solo las pensiones (y todas ellas) indican mes de servicio',
    path: ['mesServicio'],
  });
export type DatosTramo = z.infer<typeof esquemaTramo>;

/** Generador de pensiones mensuales (por defecto 10: marzo a diciembre). */
export const esquemaGenerarPensiones = z.object({
  mesInicio: z.string().regex(/^\d{4}-\d{2}$/, 'Mes inválido (AAAA-MM)'),
  cantidad: z.coerce.number().int().min(1).max(12).default(10),
  /** Si se omite se usa la pensión de referencia del plan. */
  importe: z
    .union([importePositivo, z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  /** Días después del fin de mes de servicio para el vencimiento. */
  diasGracia: z.coerce.number().int().min(0).max(60).default(0),
});
export type DatosGenerarPensiones = z.infer<typeof esquemaGenerarPensiones>;

export const esquemaObligacion = z.object({
  matriculaId: id,
  importeAcordado: importeNoNegativo,
  condicionesId: idOpcional,
});
export type DatosObligacion = z.infer<typeof esquemaObligacion>;

export const esquemaEditarObligacion = esquemaObligacion.omit({ matriculaId: true });
export type DatosEditarObligacion = z.infer<typeof esquemaEditarObligacion>;

export const consultaPlanes = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  estado: z.enum(['borrador', 'publicado']).optional(),
});

export const consultaObligaciones = consultaListado.extend({ anioId: idOpcional });

export const consultaCondiciones = z.object({ anioId: id });

export interface FilaPlan {
  id: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: string;
  version: number;
  pension_referencia: string | null;
  vigente_desde: string | null;
  publicado_en: string | null;
  condiciones_id: string | null;
  condiciones_version: number | null;
  tramos: number;
  total: string;
  cuotas: number;
}

export interface FilaTramo {
  id: string;
  plan_id: string;
  concepto: string;
  numero: number;
  importe: string;
  mes_servicio: string | null;
  exigible_desde: string;
  vence_en: string;
}

export interface CondicionEconomica {
  id: string;
  version: number;
  vigente_desde: string | null;
  publicado_en: string | null;
}

export interface FilaObligacion {
  id: string;
  estudiante_id: string;
  alumno: string;
  codigo: string;
  matricula_ingreso_id: string;
  anio: number;
  grado: string;
  importe_acordado: string;
  condiciones_id: string;
  condiciones_version: number;
  emitido: string;
  cuotas: number;
}

/** Último día del mes de 'AAAA-MM-01'. */
export function finDeMes(mesServicio: string): string {
  const [a, m] = mesServicio.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m, 0));
  return d.toISOString().slice(0, 10);
}
