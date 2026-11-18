import { z } from 'zod';
import { booleano, consultaListado, fecha, fechaOpcional, id, idOpcional, importePositivo, textoOpcional, textoRequerido, uuid } from '../comunes';
import { aCentimos } from './dinero';

/** Medios ofrecidos en la UI. Yape y Plin se guardan como 'transferencia' con referencia "Yape: <nro>". */
export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'yape', 'plin', 'otro'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];
export type MedioBase = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  otro: 'Otro',
};
export const OPCIONES_MEDIO = MEDIOS_PAGO.map((m) => ({ valor: m, etiqueta: ETIQUETA_MEDIO[m] }));

/** Medio de la UI → columnas de la base (sin cambiar la base). */
export function medioParaBase(medio: MedioPago, referencia: string | null): { medio: MedioBase; referencia: string | null } {
  if (medio === 'yape' || medio === 'plin') {
    return { medio: 'transferencia', referencia: `${medio === 'yape' ? 'Yape' : 'Plin'}: ${(referencia ?? '').trim()}` };
  }
  return { medio, referencia };
}

/** Columnas de la base → medio de la UI (reconoce Yape/Plin por la referencia). */
export function medioDesdeBase(medio: string, referencia: string | null): MedioPago {
  if (medio === 'transferencia' && referencia) {
    if (/^yape:/i.test(referencia)) return 'yape';
    if (/^plin:/i.test(referencia)) return 'plin';
  }
  return (MEDIOS_PAGO as readonly string[]).includes(medio) ? (medio as MedioPago) : 'otro';
}

export const TIPOS_DOCUMENTO_PAGANTE = ['DNI', 'CE', 'RUC', 'PAS', 'OTRO'] as const;

export const esquemaPagante = z.object({
  personaId: idOpcional,
  tipoDocumento: z
    .union([z.enum(TIPOS_DOCUMENTO_PAGANTE), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  numeroDocumento: textoOpcional(20),
  nombre: textoRequerido(200),
  direccion: textoOpcional(300),
});

export const IMPUTACIONES = ['regla', 'eleccion_pagante'] as const;

export const esquemaPago = z
  .object({
    /** UUID generado en el cliente: reintentar con la misma clave devuelve el mismo pago y recibo. */
    claveIdempotencia: uuid,
    matriculaId: id,
    serieId: id,
    medio: z.enum(MEDIOS_PAGO),
    referencia: textoOpcional(120),
    importe: importePositivo,
    /** 'regla': más antigua primero; 'eleccion_pagante': importes por cuota elegidos por el pagante. */
    imputacion: z.enum(IMPUTACIONES),
    aplicaciones: z.array(z.object({ cuotaId: id, importe: importePositivo })).max(60).default([]),
    /** Con 'regla': limita la imputación a estas cuotas (vacío = todas las de la matrícula con saldo). */
    cuotas: z.array(id).max(60).default([]),
    pagante: esquemaPagante,
  })
  .superRefine((d, ctx) => {
    if ((d.medio === 'yape' || d.medio === 'plin') && !d.referencia) {
      ctx.addIssue({ code: 'custom', path: ['referencia'], message: 'Ingrese el número de operación' });
    }
    if (d.imputacion === 'eleccion_pagante') {
      if (d.aplicaciones.length === 0) ctx.addIssue({ code: 'custom', path: ['aplicaciones'], message: 'Indique el importe de al menos una cuota' });
      const ids = d.aplicaciones.map((a) => a.cuotaId);
      if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['aplicaciones'], message: 'Cada cuota se indica una sola vez' });
    }
  });
export type DatosPago = z.infer<typeof esquemaPago>;

export const esquemaReversion = z.object({
  motivo: textoRequerido(500).refine((v) => v.length >= 5, 'Describa el motivo (mínimo 5 caracteres)'),
});
export type DatosReversion = z.infer<typeof esquemaReversion>;

export const esquemaDevolucion = z.object({
  aplicacionId: id,
  importe: importePositivo,
  motivo: textoRequerido(500).refine((v) => v.length >= 5, 'Describa el motivo (mínimo 5 caracteres)'),
  /** Devolución en efectivo: sale de la sesión de caja abierta del operador. */
  enEfectivo: booleano.default(false),
});
export type DatosDevolucion = z.infer<typeof esquemaDevolucion>;

export const TIPOS_COMPROBANTE = ['boleta', 'factura', 'nota_credito', 'nota_debito'] as const;
export const ETIQUETA_COMPROBANTE: Record<string, string> = {
  boleta: 'Boleta de venta',
  factura: 'Factura',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
};
export const ESTADOS_COMPROBANTE = ['emitido', 'aceptado', 'observado', 'anulado'] as const;

export const esquemaComprobante = z.object({
  rucEmisor: z.string().trim().regex(/^\d{11}$/, 'El RUC tiene 11 dígitos'),
  tipo: z.enum(TIPOS_COMPROBANTE),
  serie: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]{4}$/.test(v), 'Serie de 4 caracteres (p. ej. B001)'),
  numero: z.string().trim().regex(/^\d{1,8}$/, 'Número de hasta 8 dígitos'),
  emitidoEn: fecha,
  estado: z.enum(ESTADOS_COMPROBANTE).default('emitido'),
});
export type DatosComprobante = z.infer<typeof esquemaComprobante>;

export const consultaPagos = consultaListado.extend({
  desde: fechaOpcional,
  hasta: fechaOpcional,
  medio: z.enum(MEDIOS_PAGO).optional(),
  estado: z.enum(['vigente', 'revertido']).optional(),
  estudianteId: idOpcional,
  sesionId: idOpcional,
});

export const consultaAlumnos = z.object({ q: z.string().trim().min(2, 'Escriba al menos 2 caracteres').max(80) });
export const consultaCuenta = z.object({ matriculaId: idOpcional });

export interface FilaPago {
  id: string;
  pagado_en: string;
  importe: string;
  medio: string;
  medio_ui: MedioPago;
  referencia: string | null;
  pagante_nombre: string;
  estudiante_id: string | null;
  alumno: string | null;
  codigo: string | null;
  recibo_id: string | null;
  serie: string | null;
  numero: string | null;
  revertido: boolean;
  devuelto: string;
  registrado_por: string;
  sesion_caja_id: string | null;
}

export interface AplicacionDetalle {
  id: string;
  cuota_id: string;
  concepto: string;
  numero: number;
  mes_servicio: string | null;
  vence_en: string;
  importe: string;
  imputacion: string;
  devuelto: string;
}

export interface DevolucionDetalle {
  id: string;
  aplicacion_id: string;
  importe: string;
  motivo: string;
  en_efectivo: boolean;
  evidencia_id: string | null;
  autorizado_por: string;
  devuelto_en: string;
}

export interface ComprobanteDetalle {
  id: string;
  ruc_emisor: string;
  tipo: string;
  serie: string;
  numero: string;
  emitido_en: string;
  estado: string;
  archivo_id: string | null;
}

export interface DetallePago {
  id: string;
  clave_idempotencia: string;
  pagado_en: string;
  importe: string;
  medio: string;
  medio_ui: MedioPago;
  referencia: string | null;
  pagante: { personaId: string | null; tipoDocumento: string | null; numeroDocumento: string | null; nombre: string; direccion: string | null };
  registrado_por: string;
  sesion_caja_id: string | null;
  caja: string | null;
  alumno: { estudianteId: string; nombre: string; codigo: string; anio: number; grado: string; seccion: string | null } | null;
  recibo: { id: string; serie: string; numero: string; emitido_en: string; emitido_por: string } | null;
  reversion: { motivo: string; autorizado_por: string; revertido_en: string } | null;
  aplicaciones: AplicacionDetalle[];
  devoluciones: DevolucionDetalle[];
  comprobantes: ComprobanteDetalle[];
}

export interface ResultadoPago {
  pagoId: string;
  reciboId: string;
  recibo: string;
  /** true si la clave de idempotencia ya existía (reintento): se devuelve el mismo pago y recibo. */
  repetido: boolean;
}

export interface AlumnoBusqueda {
  estudiante_id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  documento: string | null;
  matricula_id: string | null;
  anio: number | null;
  grado: string | null;
  seccion: string | null;
  estado_matricula: string | null;
}

export interface ApoderadoPagante {
  persona_id: string;
  nombre: string;
  parentesco: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  direccion: string | null;
}

export interface CuotaConSaldo {
  id: string;
  concepto: string;
  numero: number;
  mes_servicio: string | null;
  exigible_desde: string;
  vence_en: string;
  importe: string;
  ajustes: string;
  abonado: string;
  saldo: string;
}

export interface MatriculaResumen {
  id: string;
  anio_id: string;
  anio: number;
  grado: string;
  seccion: string | null;
  estado: string;
}

/**
 * Imputación "más antigua primero" sobre las cuotas exigibles con saldo (en el orden recibido:
 * vencimiento, exigibilidad, concepto y número). Devuelve el excedente sin imputar, si lo hay.
 * La usa el servidor para registrar y el cliente para previsualizar.
 */
export function distribuirPorRegla(importe: string, candidatas: CuotaConSaldo[], hoy: string) {
  const exigibles = candidatas.filter((c) => aCentimos(c.saldo) > 0 && c.exigible_desde <= hoy);
  let restante = aCentimos(importe);
  const aplicaciones: { cuotaId: string; centimos: number }[] = [];
  for (const c of exigibles) {
    if (restante <= 0) break;
    const monto = Math.min(aCentimos(c.saldo), restante);
    aplicaciones.push({ cuotaId: c.id, centimos: monto });
    restante -= monto;
  }
  return { exigibles: exigibles.length, aplicaciones, excedente: Math.max(restante, 0) };
}

/** UUID v4 para la clave de idempotencia (también fuera de contextos seguros, sin crypto.randomUUID). */
export function nuevaClaveIdempotencia(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface CuentaCobro {
  alumno: { estudianteId: string; codigo: string; nombres: string; apellidos: string };
  matriculas: MatriculaResumen[];
  matricula: MatriculaResumen | null;
  cuotas: CuotaConSaldo[];
  apoderados: ApoderadoPagante[];
  hoy: string;
}
