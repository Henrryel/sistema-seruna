// Esquemas compartidos (front/back) de docentes y contratos docentes.
import { z } from 'zod';
import { booleano, consultaListado, fecha, id, idOpcional, textoOpcional, textoRequerido } from '../comunes';

export const MODALIDADES = ['fijo', 'por_horas'] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const NOMBRE_MODALIDAD: Record<Modalidad, string> = {
  fijo: 'Fijo (sueldo mensual)',
  por_horas: 'Por horas',
};

export const OPCIONES_MODALIDAD = MODALIDADES.map((m) => ({ valor: m, etiqueta: NOMBRE_MODALIDAD[m] }));

/** Texto numérico normalizado ('' si no se indicó). Se valida según la modalidad. */
const textoNumero = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined ? '' : String(v).trim().replace(',', '.')));

// ───────────── Docentes ─────────────

export const ORIGENES_PERSONA = ['existente', 'nueva'] as const;

export const esquemaDocente = z
  .object({
    origen: z.enum(ORIGENES_PERSONA),
    personaId: idOpcional,
    nombres: z.string().trim().max(120, 'Máximo 120 caracteres').optional(),
    apellidos: z.string().trim().max(120, 'Máximo 120 caracteres').optional(),
    dni: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || /^\d{8}$/.test(v), 'El DNI debe tener 8 dígitos'),
    correo: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined))
      .refine((v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Correo inválido'),
    telefono: textoOpcional(30),
    codigo: textoRequerido(30),
    activo: booleano.default(true),
  })
  .superRefine((d, ctx) => {
    if (d.origen === 'existente' && !d.personaId) {
      ctx.addIssue({ code: 'custom', path: ['personaId'], message: 'Seleccione la persona' });
    }
    if (d.origen === 'nueva') {
      if (!d.nombres) ctx.addIssue({ code: 'custom', path: ['nombres'], message: 'Requerido' });
      if (!d.apellidos) ctx.addIssue({ code: 'custom', path: ['apellidos'], message: 'Requerido' });
    }
  });

export type DatosDocente = z.infer<typeof esquemaDocente>;

export const esquemaActualizarDocente = z.object({
  codigo: textoRequerido(30),
  activo: booleano,
});

export type DatosActualizarDocente = z.infer<typeof esquemaActualizarDocente>;

export const consultaDocentes = consultaListado.extend({ activo: z.enum(['true', 'false']).optional() });

export const consultaPersonas = z.object({
  q: z.string().trim().min(2, 'Escriba al menos 2 caracteres').max(80),
});

export interface FilaDocente {
  id: string;
  persona_id: string;
  codigo: string;
  activo: boolean;
  nombres: string;
  apellidos: string;
  dni: string | null;
  contratos: number;
  contrato_vigente: string | null;
}

export interface OpcionPersona {
  id: string;
  nombres: string;
  apellidos: string;
  dni: string | null;
}

// ───────────── Contratos ─────────────

export const esquemaContrato = z
  .object({
    docenteId: id,
    referencia: textoRequerido(80),
    inicio: fecha,
    fin: fecha,
    modalidad: z.enum(MODALIDADES),
    sueldoMensual: textoNumero,
    tarifaHora: textoNumero,
    minutosPorHora: textoNumero,
  })
  .superRefine((d, ctx) => {
    if (d.fin < d.inicio)
      ctx.addIssue({ code: 'custom', path: ['fin'], message: 'El fin debe ser igual o posterior al inicio' });
    if (d.modalidad === 'fijo') {
      if (!/^\d{1,10}(\.\d{1,2})?$/.test(d.sueldoMensual) || Number(d.sueldoMensual) <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sueldoMensual'],
          message: 'Indique un sueldo mayor que cero (máximo 2 decimales)',
        });
      }
    } else {
      if (!/^\d{1,8}(\.\d{1,4})?$/.test(d.tarifaHora) || Number(d.tarifaHora) <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['tarifaHora'],
          message: 'Indique una tarifa mayor que cero (máximo 4 decimales)',
        });
      }
      const minutos = Number(d.minutosPorHora);
      if (!/^\d{1,2}$/.test(d.minutosPorHora) || minutos < 1 || minutos > 60) {
        ctx.addIssue({ code: 'custom', path: ['minutosPorHora'], message: 'Entre 1 y 60 minutos' });
      }
    }
  })
  .transform((d) => ({
    docenteId: d.docenteId,
    referencia: d.referencia,
    inicio: d.inicio,
    fin: d.fin,
    modalidad: d.modalidad,
    sueldoMensual: d.modalidad === 'fijo' ? d.sueldoMensual : null,
    tarifaHora: d.modalidad === 'por_horas' ? d.tarifaHora : null,
    minutosPorHora: d.modalidad === 'por_horas' ? Number(d.minutosPorHora) : null,
  }));

export type DatosContrato = z.infer<typeof esquemaContrato>;

export const SITUACIONES_CONTRATO = ['vigente', 'futuro', 'vencido'] as const;

export const consultaContratos = consultaListado.extend({
  docenteId: idOpcional,
  modalidad: z.enum(MODALIDADES).optional(),
  situacion: z.enum(SITUACIONES_CONTRATO).optional(),
});

/** Opciones de contratos para selects (registro de horas, liquidaciones). */
export const consultaOpcionesContrato = z.object({
  modalidad: z.enum(MODALIDADES).optional(),
  /** Contratos vigentes en esta fecha. */
  fecha: fecha.optional(),
  /** Contratos con vigencia que se cruza con este mes ('YYYY-MM-01'). */
  mes: fecha.optional(),
});

export interface FilaContrato {
  id: string;
  docente_id: string;
  docente: string;
  codigo_docente: string;
  referencia: string;
  inicio: string | null;
  fin: string | null;
  modalidad: Modalidad;
  sueldo_mensual: string | null;
  tarifa_hora: string | null;
  minutos_por_hora: number | null;
  documento_id: string | null;
  documento_nombre: string | null;
  horas: number;
  liquidaciones: number;
  registrado_en: string;
}

export interface OpcionContrato {
  valor: string;
  etiqueta: string;
  extra: { modalidad: Modalidad; docenteId: string; inicio: string | null; fin: string | null };
}

/** Descripción breve de la remuneración de un contrato o liquidación. */
export function textoRemuneracion(c: {
  modalidad: string;
  sueldo_mensual: string | null;
  tarifa_hora: string | null;
  minutos_por_hora: number | null;
}): string {
  const soles = (v: string | null) =>
    v === null
      ? '—'
      : new Intl.NumberFormat('es-PE', {
          style: 'currency',
          currency: 'PEN',
          maximumFractionDigits: 4,
        }).format(Number(v));
  if (c.modalidad === 'fijo') return `${soles(c.sueldo_mensual)} mensual`;
  return `${soles(c.tarifa_hora)} por hora de ${c.minutos_por_hora ?? '—'} min`;
}
