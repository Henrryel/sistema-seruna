// Esquemas Zod compartidos entre frontend y backend.
import { z } from 'zod';

/** Identificador bigint serializado como texto. */
export const id = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^[1-9]\d{0,18}$/.test(v), 'Identificador inválido');

export const idOpcional = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined || String(v).trim() === '' ? undefined : String(v).trim()))
  .refine((v) => v === undefined || /^[1-9]\d{0,18}$/.test(v), 'Identificador inválido');

export const parametrosId = z.object({ id });

/** Fecha calendario 'YYYY-MM-DD'. */
export const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Fecha inválida');

export const fechaOpcional = z
  .union([fecha, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : undefined));

/** Hora 'HH:MM'. */
export const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)');

/** Importe en soles como texto decimal con hasta 2 decimales (numeric(12,2)). */
export const importe = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(',', '.'))
  .refine((v) => /^-?\d{1,10}(\.\d{1,2})?$/.test(v), 'Importe inválido (máximo 2 decimales)');

export const importePositivo = importe.refine((v) => Number(v) > 0, 'El importe debe ser mayor que cero');

export const textoRequerido = (max = 200) => z.string().trim().min(1, 'Requerido').max(max, `Máximo ${max} caracteres`);
export const textoOpcional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const booleano = z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true');

export const uuid = z.string().uuid('UUID inválido');

/** Parámetros comunes de listados (búsqueda, paginación, orden y formato de exportación). */
export const consultaListado = z.object({
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(20),
  orden: z.string().max(60).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  formato: z.enum(['json', 'xlsx', 'pdf']).default('json'),
});

export type ConsultaListado = z.infer<typeof consultaListado>;

export interface RespuestaListado<F> {
  filas: F[];
  total: number;
  pagina: number;
  porPagina: number;
}

export const NIVELES_LOGRO = ['AD', 'A', 'B', 'C'] as const;
export type NivelLogro = (typeof NIVELES_LOGRO)[number];
