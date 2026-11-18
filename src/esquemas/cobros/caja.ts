import { z } from 'zod';
import { booleano, consultaListado, fechaOpcional, id, idOpcional, importe, textoRequerido } from '../comunes';

const importeNoNegativo = importe.refine((v) => Number(v) >= 0, 'El importe no puede ser negativo');

export const esquemaCaja = z.object({
  nombre: textoRequerido(80),
  activa: booleano.default(true),
});
export type DatosCaja = z.infer<typeof esquemaCaja>;

export const esquemaSerie = z.object({
  codigo: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^REC-[A-Z0-9]+$/.test(v), 'Use el formato REC-XXX (letras y números)'),
  numeroInicial: z.coerce.number().int().min(1, 'Debe ser mayor que cero').max(999_999_999).default(1),
  activa: booleano.default(true),
});
export type DatosSerie = z.infer<typeof esquemaSerie>;

export const esquemaAbrirSesion = z.object({
  cajaId: id,
  saldoInicial: importeNoNegativo,
});
export type DatosAbrirSesion = z.infer<typeof esquemaAbrirSesion>;

export const esquemaCerrarSesion = z.object({
  saldoContado: importeNoNegativo,
});
export type DatosCerrarSesion = z.infer<typeof esquemaCerrarSesion>;

export const consultaSesiones = consultaListado.extend({
  cajaId: idOpcional,
  estado: z.enum(['abierta', 'cerrada']).optional(),
  desde: fechaOpcional,
  hasta: fechaOpcional,
});

export const consultaCajas = consultaListado.extend({});
export const consultaSeries = consultaListado.extend({});

export interface FilaCaja {
  id: string;
  nombre: string;
  activa: boolean;
  sesion_abierta_id: string | null;
  operador: string | null;
  abierta_en: string | null;
}

export interface FilaSerie {
  id: string;
  codigo: string;
  numero_inicial: string;
  siguiente_numero: string;
  activa: boolean;
  recibos: number;
}

/** Arqueo: esperado = saldo inicial + efectivo cobrado vigente − devoluciones en efectivo de la sesión. */
export interface ArqueoSesion {
  saldo_inicial: string;
  efectivo_cobrado: string;
  efectivo_revertido: string;
  devoluciones_efectivo: string;
  otros_medios: string;
  pagos: number;
  esperado: string;
  saldo_contado: string | null;
  diferencia: string | null;
}

export interface FilaSesion {
  id: string;
  caja_id: string;
  caja: string;
  operador_id: string;
  operador: string;
  abierta_en: string;
  cerrada_en: string | null;
  saldo_inicial: string;
  saldo_contado: string | null;
  esperado: string;
  diferencia: string | null;
}

export interface SesionActual {
  sesion: FilaSesion | null;
  arqueo: ArqueoSesion | null;
}
