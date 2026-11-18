import { z } from 'zod';
import { consultaListado, idOpcional, importe, importePositivo, textoRequerido } from '../comunes';
import { CONCEPTOS } from './planes';

export const ESTADOS_CUOTA = ['pagado', 'pendiente', 'vencido', 'parcial'] as const;
export type EstadoCuota = (typeof ESTADOS_CUOTA)[number];
export const OPCIONES_ESTADO_CUOTA = [
  { valor: 'vencido', etiqueta: 'Vencido' },
  { valor: 'parcial', etiqueta: 'Pago parcial' },
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'pagado', etiqueta: 'Pagado' },
];

export const ALCANCES_EMISION = ['matricula', 'seccion', 'grado'] as const;

/** Emisión de cuotas: una matrícula, una sección o todo un grado del año (solo matrículas activas). */
export const esquemaEmision = z
  .object({
    alcance: z.enum(ALCANCES_EMISION),
    anioId: idOpcional,
    gradoId: idOpcional,
    seccionId: idOpcional,
    matriculaId: idOpcional,
  })
  .superRefine((d, ctx) => {
    if (d.alcance === 'matricula' && !d.matriculaId) ctx.addIssue({ code: 'custom', path: ['matriculaId'], message: 'Seleccione la matrícula' });
    if (d.alcance === 'seccion' && !d.seccionId) ctx.addIssue({ code: 'custom', path: ['seccionId'], message: 'Seleccione la sección' });
    if (d.alcance === 'grado') {
      if (!d.anioId) ctx.addIssue({ code: 'custom', path: ['anioId'], message: 'Seleccione el año' });
      if (!d.gradoId) ctx.addIssue({ code: 'custom', path: ['gradoId'], message: 'Seleccione el grado' });
    }
  });
export type DatosEmision = z.infer<typeof esquemaEmision>;

export interface ResultadoEmision {
  matriculas: number;
  emitidas: number;
  omitidas: number;
  errores: { matriculaId: string; alumno: string; mensaje: string }[];
  avisos: string[];
}

export const TIPOS_AJUSTE = ['descuento', 'exoneracion', 'correccion'] as const;
export const ETIQUETA_AJUSTE: Record<string, string> = { descuento: 'Descuento', exoneracion: 'Exoneración', correccion: 'Corrección' };

/** Ajuste tal como lo guarda la base: descuento/exoneración negativos; corrección con signo. */
export const esquemaAjuste = z.object({
  tipo: z.enum(TIPOS_AJUSTE),
  importe: importe.refine((v) => Number(v) !== 0, 'El importe no puede ser cero'),
  motivo: textoRequerido(500).refine((v) => v.length >= 5, 'Describa el motivo (mínimo 5 caracteres)'),
});
export type DatosAjuste = z.infer<typeof esquemaAjuste>;

/** Formulario de ajuste: monto positivo y sentido; se convierte al formato de la base con `aAjuste`. */
export const esquemaFormularioAjuste = z.object({
  tipo: z.enum(TIPOS_AJUSTE),
  monto: importePositivo,
  sentido: z.enum(['disminuir', 'aumentar']).default('disminuir'),
  motivo: textoRequerido(500).refine((v) => v.length >= 5, 'Describa el motivo (mínimo 5 caracteres)'),
});
export type FormularioAjuste = z.infer<typeof esquemaFormularioAjuste>;

export function aAjuste(f: FormularioAjuste): DatosAjuste {
  const negativo = f.tipo !== 'correccion' || f.sentido === 'disminuir';
  return { tipo: f.tipo, importe: negativo ? `-${f.monto}` : f.monto, motivo: f.motivo };
}

export const consultaCuotas = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  seccionId: idOpcional,
  matriculaId: idOpcional,
  concepto: z.enum(CONCEPTOS).optional(),
  estado: z.enum(ESTADOS_CUOTA).optional(),
});

export interface FilaCuota {
  id: string;
  matricula_id: string;
  estudiante_id: string;
  alumno: string;
  codigo: string;
  anio: number;
  grado: string;
  seccion: string | null;
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

export interface FilaAjuste {
  id: string;
  cuota_id: string;
  tipo: string;
  importe: string;
  motivo: string;
  autorizado_por: string;
  registrado_en: string;
}

/** Descripción corta de una cuota: "Pensión marzo 2026", "Matrícula", "Cuota de ingreso 2". */
export function descripcionCuota(c: { concepto: string; numero: number; mes_servicio: string | null }): string {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  if (c.concepto === 'pension' && c.mes_servicio) {
    const m = /^(\d{4})-(\d{2})/.exec(c.mes_servicio);
    if (m) return `Pensión ${MESES[Number(m[2]) - 1]} ${m[1]}`;
  }
  if (c.concepto === 'matricula') return 'Matrícula';
  if (c.concepto === 'ingreso') return c.numero > 1 ? `Cuota de ingreso ${c.numero}` : 'Cuota de ingreso';
  return `${c.concepto} ${c.numero}`;
}
