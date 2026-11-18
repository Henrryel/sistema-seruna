import { z } from 'zod';
import { booleano, consultaListado, fecha, fechaOpcional, hora, id, idOpcional, textoRequerido } from '../comunes';

// Políticas de asistencia, jornadas (sección/docente) y lectores QR.

export const ALCANCES_POLITICA = ['alumno', 'docente'] as const;
export type AlcancePolitica = (typeof ALCANCES_POLITICA)[number];

const minutos = (max: number) => z.coerce.number({ invalid_type_error: 'Ingrese minutos' }).int('Solo minutos enteros').min(0, 'Mínimo 0').max(max, `Máximo ${max}`);

export const esquemaPolitica = z
  .object({
    anioId: id,
    alcance: z.enum(ALCANCES_POLITICA),
    turno: textoRequerido(40),
    vigenciaInicio: fecha,
    vigenciaFin: fecha,
    admiteQr: booleano.default(true),
    admiteManual: booleano.default(true),
    toleranciaMinutos: minutos(120),
    ventanaEntradaMinutos: minutos(720),
    ventanaSalidaMinutos: minutos(720),
  })
  .refine((d) => d.vigenciaFin >= d.vigenciaInicio, { message: 'El fin debe ser posterior al inicio', path: ['vigenciaFin'] })
  .refine((d) => d.admiteQr || d.admiteManual, { message: 'Debe admitir QR, manual o ambos', path: ['admiteManual'] });

export type DatosPolitica = z.infer<typeof esquemaPolitica>;

export const consultaPoliticas = consultaListado.extend({
  anioId: idOpcional,
  alcance: z.enum(ALCANCES_POLITICA).optional(),
});

export interface FilaPolitica {
  id: string;
  anio_id: string;
  anio: number;
  alcance: AlcancePolitica;
  turno: string;
  vigencia_inicio: string | null;
  vigencia_fin: string | null;
  admite_qr: boolean;
  admite_manual: boolean;
  tolerancia_minutos: number;
  ventana_entrada_minutos: number;
  ventana_salida_minutos: number;
  jornadas: number;
}

// ── Jornadas ──────────────────────────────────────────────────────────────────

export const TIPOS_JORNADA = ['seccion', 'docente'] as const;
export type TipoJornada = (typeof TIPOS_JORNADA)[number];

const MAX_DIAS_GENERACION = 400;

export const esquemaGenerarJornadas = z
  .object({
    tipo: z.enum(TIPOS_JORNADA),
    politicaId: id,
    desde: fecha,
    hasta: fecha,
    entrada: hora,
    salida: hora,
    seccionIds: z.array(id).max(500).default([]),
    docenteIds: z.array(id).max(1000).default([]),
  })
  .refine((d) => d.hasta >= d.desde, { message: 'El fin debe ser posterior al inicio', path: ['hasta'] })
  .refine((d) => d.salida > d.entrada, { message: 'La salida debe ser posterior a la entrada', path: ['salida'] })
  .refine((d) => (Date.parse(`${d.hasta}T00:00:00Z`) - Date.parse(`${d.desde}T00:00:00Z`)) / 86_400_000 <= MAX_DIAS_GENERACION, {
    message: `El rango no puede superar ${MAX_DIAS_GENERACION} días`,
    path: ['hasta'],
  })
  .refine((d) => (d.tipo === 'seccion' ? d.seccionIds.length > 0 : d.docenteIds.length > 0), {
    message: 'Seleccione al menos una sección o docente',
    path: ['seccionIds'],
  });

export type DatosGenerarJornadas = z.infer<typeof esquemaGenerarJornadas>;

export interface ResultadoGeneracion {
  fechas: number;
  creadas: number;
  omitidas: number;
  fuente: 'calendario' | 'lunes-viernes';
}

export const esquemaCancelarJornada = z.object({
  tipo: z.enum(TIPOS_JORNADA),
  id,
  motivo: textoRequerido(300),
});

export const consultaJornadas = consultaListado.extend({
  tipo: z.enum(TIPOS_JORNADA).default('seccion'),
  anioId: idOpcional,
  desde: fechaOpcional,
  hasta: fechaOpcional,
  estado: z.enum(['programada', 'cancelada']).optional(),
});

export interface FilaJornada {
  id: string;
  tipo: TipoJornada;
  fecha: string;
  entrada: string;
  salida: string;
  estado: string;
  destino: string;
  politica: string;
  registros: number;
}

export interface OpcionesGeneracion {
  secciones: { id: string; etiqueta: string; turno: string }[];
  docentes: { id: string; etiqueta: string }[];
}

// ── Lectores QR ───────────────────────────────────────────────────────────────

export const esquemaLector = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(40, 'Máximo 40 caracteres')
    .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guion y guion bajo')
    .transform((v) => v.toUpperCase()),
  nombre: textoRequerido(120),
  activo: booleano.default(true),
});

export type DatosLector = z.infer<typeof esquemaLector>;

export const consultaLectores = consultaListado.extend({ activo: z.enum(['true', 'false']).optional() });

export interface FilaLector {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  marcaciones: number;
  ultima_marcacion: string | null;
}
