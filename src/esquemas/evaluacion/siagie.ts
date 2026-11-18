import { z } from 'zod';
import { consultaListado, id, idOpcional, textoOpcional } from '../comunes';

export const consultaPlantillas = consultaListado.extend({
  anioId: idOpcional,
  seccionId: idOpcional,
  bimestreId: idOpcional,
});

/** Campos del FormData al subir la plantilla oficial (el archivo va en `archivo`). */
export const esquemaPlantilla = z.object({ seccionId: id, bimestreId: id });

/**
 * Mapeo competencia → hoja/columnas. Columnas en numeración Excel desde 1 (A=1, B=2, …): el nivel de logro va
 * en una columna PAR ≥ 4 (D, F, H, …) y la conclusión en la siguiente (la base exige conclusión = NL + 1).
 */
export const esquemaMapeo = z.object({
  competenciaId: id,
  hoja: z.string().trim().min(1, 'Indique la hoja').max(31, 'Máximo 31 caracteres'),
  codigoExcel: z.string().trim().regex(/^\d+$/, 'Solo dígitos'),
  columnaNl: z.coerce.number().int().min(4, 'Mínimo 4 (columna D)').max(16382),
});

export const esquemaCopiarMapeos = z.object({ desdePlantillaId: id });
export const consultaQuitarMapeo = z.object({ mapeoId: id });

export const esquemaResolverExportacion = z
  .object({ estado: z.enum(['aceptada', 'rechazada']), observacion: textoOpcional(1000) })
  .superRefine((d, ctx) => {
    if (d.estado === 'rechazada' && !d.observacion) {
      ctx.addIssue({ code: 'custom', path: ['observacion'], message: 'Indique el motivo del rechazo' });
    }
  });

/** Convierte un número de columna (1 = A) a letras de Excel. */
export function letraColumna(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export interface FilaPlantilla {
  id: string;
  seccion_id: string;
  seccion: string;
  grado: number;
  nivel: string;
  bimestre_id: string;
  bimestre: number;
  anio: number;
  version: number;
  archivo_id: string;
  archivo: string;
  mapeos: number;
  exportaciones: number;
  cierre_estado: string | null;
}

export interface MapeoFila {
  id: string;
  competencia_id: string;
  competencia: string;
  codigo_competencia: string;
  hoja: string;
  codigo_excel: string;
  columna_nl: number;
  columna_conclusion: number;
}

export interface ExportacionFila {
  id: string;
  estado: 'preparada' | 'generada' | 'aceptada' | 'rechazada';
  solicitado_en: string;
  solicitado_por: string;
  observacion: string | null;
  resultado_archivo_id: string | null;
  notas: number;
}

export interface DetallePlantilla extends FilaPlantilla {
  hojas: string[];
  mapeosDetalle: MapeoFila[];
  competencias: { id: string; codigo: string; nombre: string; reportable_siagie: boolean; mapeada: boolean }[];
  exportacionesDetalle: ExportacionFila[];
  otrasPlantillas: { id: string; etiqueta: string }[];
}

/** Contenido que arma `preparar_exportacion_siagie` (jsonb). */
export interface ContenidoExportacion {
  sha256: string;
  mapeos: { hoja: string; codigo: string; nl: number; conclusion: number }[] | null;
  notas: { hoja: string; codigo_excel: string; alumno: string; nl: string | null; conclusion: string | null }[];
}

export interface ResultadoGeneracionSiagie {
  exportacionId: string;
  archivoId: string;
  escritas: number;
  advertencias: string[];
}
