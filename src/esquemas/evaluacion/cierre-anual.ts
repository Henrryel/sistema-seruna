import { z } from 'zod';
import { consultaListado, id, idOpcional, textoRequerido } from '../comunes';
import { SITUACIONES, type EvaluacionCriterios, type Situacion } from './criterios';

export const ETAPAS = ['ordinario', 'rectificacion', 'recuperacion'] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  ordinario: 'Ordinario',
  rectificacion: 'Rectificación',
  recuperacion: 'Recuperación',
};

export const consultaCierresAnuales = consultaListado.extend({
  anioId: idOpcional,
  seccionId: idOpcional,
  estado: z.enum(['borrador', 'aprobado']).optional(),
  situacion: z.enum(SITUACIONES).optional(),
});

/** Genera los borradores (versión 1, ordinario) de las matrículas de una sección o de todo el año. */
export const esquemaGenerarCierres = z.object({ anioId: id, seccionId: idOpcional });

export const esquemaAprobarCierre = z.object({
  situacion: z.enum(SITUACIONES),
  sustento: textoRequerido(2000),
  /** Si se indica, reemplaza las competencias marcadas como pendientes de recuperación. */
  pendientes: z.array(id).max(200).optional(),
});

export type AprobarCierre = z.infer<typeof esquemaAprobarCierre>;

export const esquemaAprobarLote = z.object({
  ids: z.array(id).min(1).max(500),
  sustento: textoRequerido(2000),
});

export const esquemaNuevaVersion = z.object({
  etapa: z.enum(['rectificacion', 'recuperacion']),
  motivo: textoRequerido(1000),
});

export interface FilaCierreAnual {
  id: string;
  matricula_id: string;
  estudiante_id: string;
  codigo: string;
  alumno: string;
  seccion: string;
  grado: number;
  nivel: string;
  version: number;
  etapa: Etapa;
  estado: 'borrador' | 'aprobado';
  situacion: Situacion | null;
  fecha_corte: string;
  aprobado_en: string | null;
  resultados: number;
  pendientes: number;
  versiones: number;
}

export interface ResultadoAnualDetalle {
  id: string;
  competencia_id: string;
  competencia: string;
  codigo: string;
  area: string | null;
  area_codigo: string | null;
  nivel_logro: string;
  conclusion: string | null;
  requiere_recuperacion: boolean;
  fuente: 'calificacion' | 'recuperacion' | 'anterior';
  bimestre: number | null;
}

export interface DetalleCierreAnual extends FilaCierreAnual {
  regla: { id: string; version: number; referencia: string };
  sustento: string | null;
  motivo_revision: string | null;
  anterior_id: string | null;
  resultados_detalle: ResultadoAnualDetalle[];
  faltantes: { competencia_id: string; competencia: string; area: string | null }[];
  sugerencia: (EvaluacionCriterios & { error?: undefined }) | { error: string };
  trayectoria: { id: string; version: number; etapa: Etapa; estado: string; situacion: string | null; aprobado_en: string | null }[];
  recuperacionesAprobadas: number;
}

export interface ResultadoGeneracion {
  creados: number;
  omitidos: { matriculaId: string; alumno: string; motivo: string }[];
}
