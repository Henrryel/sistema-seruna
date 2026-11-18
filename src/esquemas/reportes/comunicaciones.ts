import { z } from 'zod';
import { consultaListado, id, idOpcional, textoOpcional, textoRequerido } from '../comunes';

export const CANALES_COMUNICACION = ['presencial', 'correo', 'whatsapp', 'plataforma', 'telefono', 'otro'] as const;

export const NOMBRE_CANAL: Record<string, string> = {
  presencial: 'Presencial',
  correo: 'Correo electrónico',
  whatsapp: 'WhatsApp',
  plataforma: 'Plataforma',
  telefono: 'Teléfono',
  otro: 'Otro',
};

/** Fecha y hora local 'YYYY-MM-DDTHH:MM' (input datetime-local) o ISO. */
const fechaHora = z
  .string()
  .trim()
  .min(1, 'Indique la fecha y hora')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha y hora inválida');

/**
 * Comunicación de un documento institucional a una persona o a un alcance (p. ej. "Padres de 1.º A").
 * La base exige destinatario o alcance (`comunicaciones_documento_check`).
 */
export const esquemaComunicacion = z.object({
  documentoId: id,
  destinatarioId: idOpcional,
  alcance: textoOpcional(200),
  comunicadoEn: fechaHora,
  canal: textoRequerido(40),
});

export type DatosComunicacion = z.infer<typeof esquemaComunicacion>;
export type FormularioComunicacion = z.input<typeof esquemaComunicacion>;

export const consultaComunicaciones = consultaListado.extend({
  documentoId: idOpcional,
  canal: z.string().max(40).optional(),
});

export const consultaPersonas = z.object({ q: z.string().trim().min(2, 'Escriba al menos 2 letras').max(100) });

export interface FilaComunicacion {
  id: string;
  documento_id: string;
  documento_tipo: string;
  documento_version: number;
  anio: number;
  destinatario_id: string | null;
  destinatario: string | null;
  alcance: string | null;
  comunicado_en: string;
  canal: string;
  evidencia_id: string | null;
  evidencia_nombre: string | null;
  registrado_por_login: string | null;
}

export interface OpcionDocumentoInstitucional {
  id: string;
  tipo: string;
  version: number;
  anio: number;
  publicado_en: string | null;
  vigente_desde: string | null;
}

export const NOMBRE_DOCUMENTO_INSTITUCIONAL: Record<string, string> = {
  reglamento: 'Reglamento interno',
  contrato: 'Contrato de servicios',
  condiciones_economicas: 'Condiciones económicas',
};
