import { z } from 'zod';
import { consultaListado, fechaOpcional, id, idOpcional } from '../comunes';
import { TIPOS_DOCUMENTO_INSTITUCIONAL } from './comunes';

/** Campos de la carga de un documento institucional (multipart con `archivo` PDF). */
export const esquemaDocumentoInstitucional = z.object({
  anioId: id,
  tipo: z.enum(TIPOS_DOCUMENTO_INSTITUCIONAL),
  vigenteDesde: fechaOpcional,
});
export type DatosDocumentoInstitucional = z.infer<typeof esquemaDocumentoInstitucional>;

/** La base exige vigente_desde para publicar (CHECK). */
export const esquemaPublicacionDocumento = z.object({ vigenteDesde: fechaOpcional });

export const consultaDocumentosInstitucionales = consultaListado.extend({
  anioId: idOpcional,
  tipo: z.enum(TIPOS_DOCUMENTO_INSTITUCIONAL).optional(),
});

export interface FilaDocumentoInstitucional {
  id: string;
  anio_id: string;
  anio: number;
  tipo: string;
  version: number;
  archivo_id: string;
  nombre_archivo: string;
  bytes: number;
  vigente_desde: string | null;
  publicado_en: string | null;
  aceptaciones: number;
}
