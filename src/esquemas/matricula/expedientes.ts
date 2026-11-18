import { z } from 'zod';
import { consultaListado, id, idOpcional, textoOpcional } from '../comunes';
import { ESTADOS_DOCUMENTO_EXPEDIENTE } from './comunes';

/** Campos de la carga (multipart con `archivo`). */
export const esquemaCargaExpediente = z.object({
  estudianteId: id,
  matriculaId: idOpcional,
  tipoDocumentoId: id,
});
export type DatosCargaExpediente = z.infer<typeof esquemaCargaExpediente>;

export const esquemaRevision = z
  .object({ estado: z.enum(['validado', 'observado']), observacion: textoOpcional(500) })
  .refine((d) => d.estado !== 'observado' || Boolean(d.observacion), { message: 'Indique qué se debe corregir', path: ['observacion'] });
export type DatosRevision = z.infer<typeof esquemaRevision>;

export const consultaExpedientes = consultaListado.extend({
  estudianteId: idOpcional,
  matriculaId: idOpcional,
  tipoDocumentoId: idOpcional,
  estado: z.enum(ESTADOS_DOCUMENTO_EXPEDIENTE).optional(),
});

export const consultaChecklist = z.object({ matriculaId: id });

export interface FilaDocumentoExpediente {
  id: string;
  estudiante_id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  matricula_id: string | null;
  anio: number | null;
  tipo_documento_id: string;
  tipo_documento: string;
  archivo_id: string;
  nombre_archivo: string;
  estado: string;
  cargado_en: string;
  revisado_en: string | null;
  observacion: string | null;
}

export type EstadoRequisito = 'validado' | 'pendiente' | 'observado' | 'en_regularizacion' | 'faltante';

export interface ItemChecklist {
  tipo_documento_id: string;
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  admite_regularizacion: boolean;
  plazo_regularizacion: string | null;
  documento_id: string | null;
  estado_documento: string | null;
  observacion: string | null;
  estado: EstadoRequisito;
}

export interface Checklist {
  matricula_id: string;
  regla_id: string;
  items: ItemChecklist[];
  completo: boolean;
  obligatoriosValidados: number;
  obligatorios: number;
}
