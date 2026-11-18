import { z } from 'zod';
import { consultaListado, id, idOpcional, textoRequerido } from '../comunes';

export const FORMATOS_DOCUMENTO = ['pdf', 'xlsx'] as const;
export type FormatoDocumento = (typeof FORMATOS_DOCUMENTO)[number];

export const ESTADOS_PLANTILLA = ['borrador', 'publicada'] as const;

/** Texto JSON → objeto (la base exige `jsonb_typeof(configuracion) = 'object'`). */
const configuracionJson = z
  .union([z.string(), z.record(z.unknown()), z.null(), z.undefined()])
  .transform((v, ctx): unknown => {
    if (v === null || v === undefined) return {};
    if (typeof v !== 'string') return v;
    if (v.trim() === '') return {};
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La configuración no es un JSON válido' });
      return z.NEVER;
    }
  });

/**
 * Plantilla de documento. Las reglas (formato pdf/xlsx, versión > 0 y única por tipo/año/formato,
 * configuración objeto, inmutabilidad al publicar) las impone la base.
 */
export const esquemaPlantilla = z.object({
  tipo: textoRequerido(60),
  anioId: id,
  formato: z.enum(FORMATOS_DOCUMENTO),
  /** Opcional: si se omite, se usa la siguiente versión libre del tipo/año/formato. */
  version: z
    .union([z.coerce.number().int(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? undefined : v)),
  nombre: textoRequerido(150),
  configuracion: configuracionJson,
});

export type DatosPlantilla = z.infer<typeof esquemaPlantilla>;
/** Valores del formulario en el cliente (configuración como texto). */
export type FormularioPlantilla = z.input<typeof esquemaPlantilla>;

export const consultaPlantillas = consultaListado.extend({
  anioId: idOpcional,
  tipo: z.string().max(60).optional(),
  /** Filtro por formato de la plantilla (`formato` ya es el formato de exportación del listado). */
  formatoDocumento: z.enum(FORMATOS_DOCUMENTO).optional(),
  estado: z.enum(ESTADOS_PLANTILLA).optional(),
});

export interface FilaPlantilla {
  id: string;
  tipo: string;
  tipo_nombre: string;
  anio_id: string;
  anio: number;
  formato: string;
  version: number;
  nombre: string;
  archivo_id: string | null;
  archivo_nombre: string | null;
  configuracion: Record<string, unknown>;
  creada_por: string;
  creada_por_login: string | null;
  creada_en: string;
  publicada_en: string | null;
  documentos: number;
}

/** Plantilla publicada disponible para solicitar documentos. */
export interface OpcionPlantilla {
  id: string;
  tipo: string;
  tipo_nombre: string;
  anio_id: string;
  anio: number;
  anio_inicio: string;
  anio_fin: string;
  formato: string;
  version: number;
  nombre: string;
}
