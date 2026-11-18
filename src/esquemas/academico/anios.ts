import { z } from 'zod';
import { consultaListado, fecha } from '../comunes';

export const ESTADOS_ANIO = ['borrador', 'abierto', 'cerrado'] as const;

export const esquemaAnio = z
  .object({
    anio: z.coerce.number().int().min(2000).max(2200),
    inicio: fecha,
    fin: fecha,
    estado: z.enum(ESTADOS_ANIO).default('borrador'),
  })
  .refine((d) => d.fin >= d.inicio, { message: 'El fin debe ser posterior al inicio', path: ['fin'] });

export type DatosAnio = z.infer<typeof esquemaAnio>;

const fechaHoraOpcional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Fecha y hora inválida');

export const esquemaBimestre = z
  .object({
    numero: z.coerce.number().int().min(1).max(4),
    inicio: fecha,
    fin: fecha,
    registroInicio: fechaHoraOpcional,
    registroFin: fechaHoraOpcional,
  })
  .refine((d) => d.fin >= d.inicio, { message: 'El fin debe ser posterior al inicio', path: ['fin'] });

export type DatosBimestre = z.infer<typeof esquemaBimestre>;

export const consultaAnios = consultaListado.extend({ estado: z.enum(ESTADOS_ANIO).optional() });

export interface FilaAnio {
  id: string;
  anio: number;
  inicio: string;
  fin: string;
  estado: string;
  bimestres: number;
}

export interface FilaBimestre {
  id: string;
  anio_id: string;
  numero: number;
  inicio: string;
  fin: string;
  registro_inicio: string | null;
  registro_fin: string | null;
}
