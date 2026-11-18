import { z } from 'zod';
import { NIVELES_LOGRO, consultaListado, fecha, id, idOpcional, textoOpcional } from '../comunes';

export const TIPOS_RECUPERACION = ['recuperacion', 'subsanacion'] as const;

export const ETIQUETA_TIPO_RECUPERACION: Record<(typeof TIPOS_RECUPERACION)[number], string> = {
  recuperacion: 'Recuperación pedagógica',
  subsanacion: 'Subsanación',
};

export const consultaPendientes = consultaListado.extend({
  anioId: idOpcional,
  seccionId: idOpcional,
  estado: z.enum(['sin_evaluacion', 'borrador', 'aprobada']).optional(),
});

export const esquemaRecuperacion = z.object({
  resultadoOrigenId: id,
  tipo: z.enum(TIPOS_RECUPERACION),
  fecha,
  nivelLogro: z.enum(NIVELES_LOGRO),
  conclusion: textoOpcional(2000),
});

export const esquemaEditarRecuperacion = esquemaRecuperacion.omit({ resultadoOrigenId: true });

export type DatosRecuperacion = z.infer<typeof esquemaRecuperacion>;

export interface EvaluacionRecuperacionFila {
  id: string;
  intento: number;
  tipo: string;
  fecha: string;
  nivel_logro: string;
  conclusion: string | null;
  estado: 'borrador' | 'aprobada';
  aprobado_en: string | null;
}

export interface FilaPendienteRecuperacion {
  resultado_id: string;
  cierre_anual_id: string;
  cierre_version: number;
  matricula_id: string;
  codigo: string;
  alumno: string;
  seccion: string;
  grado: number;
  nivel: string;
  competencia: string;
  area: string | null;
  nivel_original: string;
  fecha_corte: string;
  evaluaciones: EvaluacionRecuperacionFila[];
}
