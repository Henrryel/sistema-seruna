import { z } from 'zod';
import { booleano, consultaListado, fecha, fechaOpcional, id, idOpcional } from '../comunes';
import { CONCEPTOS } from './planes';
import type { CuotaConSaldo, MatriculaResumen, MedioPago } from './pagos';

export const consultaMorosidad = consultaListado.extend({
  anioId: id,
  /** Fecha de corte (por defecto hoy, America/Lima). */
  corte: fechaOpcional,
  gradoId: idOpcional,
  seccionId: idOpcional,
  concepto: z.enum(CONCEPTOS).optional(),
  /** Solo cuotas vencidas al corte con saldo (morosidad). Si es false, todas las cuotas con saldo. */
  soloVencidas: booleano.default(true),
});
export type ConsultaMorosidad = z.infer<typeof consultaMorosidad>;

export const consultaResumenMorosidad = consultaMorosidad.omit({ pagina: true, porPagina: true, formato: true, orden: true, dir: true });

export const consultaRecaudacion = z
  .object({
    desde: fecha,
    hasta: fecha,
    formato: z.enum(['json', 'xlsx', 'pdf']).default('json'),
  })
  .refine((d) => d.hasta >= d.desde, { message: 'El rango de fechas es inválido', path: ['hasta'] })
  .refine((d) => Date.parse(d.hasta) - Date.parse(d.desde) <= 400 * 86_400_000, { message: 'El rango máximo es de 400 días', path: ['hasta'] });

export interface FilaMorosidad {
  cuota_id: string;
  matricula_id: string;
  estudiante_id: string;
  alumno: string;
  codigo: string;
  grado: string;
  seccion: string | null;
  concepto: string;
  numero: number;
  mes_servicio: string | null;
  vence_en: string;
  importe: string;
  ajustes: string;
  abonado: string;
  saldo: string;
  dias_atraso: number;
}

export interface ResumenMorosidad {
  corte: string;
  cuotas: number;
  alumnos: number;
  saldo: string;
  vencido: string;
}

export interface FilaRecaudacionDia {
  fecha: string;
  efectivo: string;
  transferencia: string;
  yape: string;
  plin: string;
  tarjeta: string;
  otro: string;
  cobrado: string;
  revertido: string;
  devuelto: string;
  neto: string;
  pagos: number;
}

export interface Recaudacion {
  desde: string;
  hasta: string;
  porDia: FilaRecaudacionDia[];
  porMedio: { medio: MedioPago; pagos: number; importe: string }[];
  totales: { cobrado: string; revertido: string; devuelto: string; neto: string; pagos: number };
}

/** Estado de cuenta para los portales de estudiante y padres. */
export interface PagoPortal {
  id: string;
  pagado_en: string;
  importe: string;
  medio_ui: MedioPago;
  recibo_id: string | null;
  recibo: string | null;
  revertido: boolean;
  devuelto: string;
  detalle: string;
}

export interface EstadoCuenta {
  estudiante: { estudianteId: string; codigo: string; nombres: string; apellidos: string };
  matriculas: MatriculaResumen[];
  matricula: MatriculaResumen | null;
  cuotas: CuotaConSaldo[];
  pagos: PagoPortal[];
  resumen: { total: string; abonado: string; saldo: string; vencido: string };
  hoy: string;
}
