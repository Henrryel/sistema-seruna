// Esquemas compartidos (front/back) de períodos, liquidaciones, pagos y reversiones docentes.
import { z } from 'zod';
import {
  consultaListado,
  id,
  idOpcional,
  importePositivo,
  textoOpcional,
  textoRequerido,
  uuid,
} from '../comunes';
import type { Modalidad } from './contratos';

// ───────────── Períodos ─────────────

export const esquemaPeriodo = z.object({
  mes: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (AAAA-MM)'),
});

export type DatosPeriodo = z.infer<typeof esquemaPeriodo>;

export interface FilaPeriodo {
  id: string;
  mes: string;
  estado: 'abierto' | 'cerrado';
  creado_en: string;
  cerrado_en: string | null;
  borradores: number;
  aprobadas: number;
  horas_pendientes: number;
  horas_sin_liquidar: number;
}

// ───────────── Liquidaciones ─────────────

export const ESTADOS_LIQUIDACION = ['borrador', 'aprobada'] as const;
export type EstadoLiquidacion = (typeof ESTADOS_LIQUIDACION)[number];

const importeOpcional = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined ? '' : String(v).trim().replace(',', '.')))
  .refine((v) => v === '' || /^\d{1,10}(\.\d{1,2})?$/.test(v), 'Importe inválido (máximo 2 decimales)')
  .transform((v) => (v === '' ? null : v));

export const esquemaLiquidacion = z.object({
  contratoId: id,
  periodoId: id,
  /** Solo contratos fijos con prorrateo: importe autorizado (la base exige motivo). */
  importeFijo: importeOpcional,
  motivoProrrateo: textoOpcional(300),
});

export type DatosLiquidacion = z.infer<typeof esquemaLiquidacion>;

export const consultaLiquidaciones = consultaListado.extend({
  periodoId: idOpcional,
  estado: z.enum(ESTADOS_LIQUIDACION).optional(),
});

export interface FilaLiquidacion {
  id: string;
  periodo_id: string;
  mes: string;
  periodo_estado: string;
  contrato_id: string;
  referencia: string;
  docente_id: string;
  docente: string;
  codigo_docente: string;
  modalidad: Modalidad;
  estado: EstadoLiquidacion;
  minutos_aprobados: number;
  base: string;
  adicionales: string;
  descuentos: string;
  neto: string;
  abonado: string;
  saldo: string | null;
}

export const TIPOS_LINEA = ['adicional', 'descuento'] as const;
export type TipoLinea = (typeof TIPOS_LINEA)[number];

export const esquemaLinea = z.object({
  tipo: z.enum(TIPOS_LINEA),
  concepto: textoRequerido(150),
  importe: importePositivo,
});

export type DatosLinea = z.infer<typeof esquemaLinea>;

export const parametrosDetalle = z.object({ id, detalleId: id });

export interface LineaLiquidacion {
  id: string;
  tipo: 'horas' | TipoLinea;
  concepto: string;
  importe: string | null;
  hora_docente_id: string | null;
  fecha: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  minutos: number | null;
  registrado_en: string;
}

export const MEDIOS_PAGO = ['transferencia', 'efectivo', 'otro'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const OPCIONES_MEDIO_PAGO = [
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const esquemaPago = z.object({
  claveIdempotencia: uuid,
  importe: importePositivo,
  medio: z.enum(MEDIOS_PAGO),
  referencia: textoOpcional(120),
});

export type DatosPago = z.infer<typeof esquemaPago>;

export const esquemaReversion = z.object({
  motivo: textoRequerido(300),
});

export type DatosReversion = z.infer<typeof esquemaReversion>;

export interface PagoLiquidacion {
  id: string;
  importe: string;
  medio: MedioPago;
  referencia: string | null;
  evidencia_id: string | null;
  pagado_en: string;
  reversion_id: string | null;
  revertido_en: string | null;
  motivo_reversion: string | null;
  evidencia_reversion_id: string | null;
}

export interface Totales {
  minutos_aprobados: number;
  base: string;
  adicionales: string;
  descuentos: string;
  neto: string;
  abonado: string;
  saldo: string | null;
}

export interface DetalleLiquidacion {
  id: string;
  estado: EstadoLiquidacion;
  periodo_id: string;
  mes: string;
  periodo_estado: string;
  contrato_id: string;
  referencia: string;
  docente_id: string;
  docente: string;
  codigo_docente: string;
  dni: string | null;
  modalidad: Modalidad;
  sueldo_mensual: string | null;
  tarifa_hora: string | null;
  minutos_por_hora: number | null;
  vigencia_inicio: string | null;
  vigencia_fin: string | null;
  importe_fijo: string | null;
  motivo_prorrateo: string | null;
  registrado_en: string;
  aprobado_en: string | null;
  totales: Totales;
  lineas: LineaLiquidacion[];
  pagos: PagoLiquidacion[];
  /** Horas del contrato en el mes que impiden aprobar (por horas). */
  horas_pendientes: number;
  horas_por_incluir: number;
}

// ───────────── Descuento por tardanzas ─────────────

export interface DiaTardanza {
  fecha: string;
  inicio_jornada: string;
  tolerancia_minutos: number;
  entrada: string | null;
  /** null: tardanza registrada sin marcación de entrada (no se puede medir). */
  minutos: number | null;
}

export interface VistaPreviaTardanzas {
  dias: DiaTardanza[];
  minutos: number;
  /** Fijo: minutos programados de jornadas del mes; por horas: minutos por hora pedagógica. */
  minutos_base: number;
  /** Sueldo mensual (fijo) o tarifa por hora (por horas) congelados en la liquidación. */
  monto_base: string | null;
  valor_minuto: string | null;
  importe: string;
  concepto: string;
  ya_registrado: boolean;
}

export const PREFIJO_TARDANZAS = 'Tardanzas (';

export const conceptoTardanzas = (minutos: number) => `${PREFIJO_TARDANZAS}${minutos} min)`;
