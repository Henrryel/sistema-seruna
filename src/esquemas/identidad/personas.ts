import { z } from 'zod';
import { booleano, consultaListado, fechaOpcional, textoOpcional, textoRequerido } from '../comunes';

// Personas y documentos de identidad. Las reglas del DNI (8 dígitos, país PE) y del número en mayúsculas
// las impone la base (CHECK); aquí solo se normaliza la entrada (trim + mayúsculas).

export const TIPOS_DOCUMENTO = ['DNI', 'CE', 'PASAPORTE'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const NOMBRE_TIPO_DOCUMENTO: Record<string, string> = {
  DNI: 'DNI',
  CE: 'Carné de extranjería',
  PASAPORTE: 'Pasaporte',
};

export const esquemaDocumento = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO, { errorMap: () => ({ message: 'Seleccione el tipo de documento' }) }),
  paisEmisor: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Código de país de 2 letras (p. ej. PE)')
    .default('PE'),
  numero: z.string().trim().toUpperCase().min(1, 'Requerido').max(20, 'Máximo 20 caracteres'),
  verificado: booleano.default(false),
});

export type DatosDocumento = z.infer<typeof esquemaDocumento>;

const correo = z
  .union([z.literal(''), z.null(), z.string().trim().email('Correo inválido').max(200, 'Máximo 200 caracteres')])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null));

export const esquemaPersona = z.object({
  nombres: textoRequerido(120),
  apellidos: textoRequerido(120),
  fechaNacimiento: fechaOpcional,
  correoContacto: correo,
  telefono: textoOpcional(30),
  direccion: textoOpcional(300),
});

export type DatosPersona = z.infer<typeof esquemaPersona>;

/** Alta de persona con un documento inicial opcional (si el número está vacío se ignora). */
export const esquemaCrearPersona = esquemaPersona.extend({
  documento: z.preprocess(
    (v) => (v && typeof v === 'object' && String((v as { numero?: unknown }).numero ?? '').trim() !== '' ? v : undefined),
    esquemaDocumento.optional(),
  ),
});

export type DatosCrearPersona = z.infer<typeof esquemaCrearPersona>;

export const consultaPersonas = consultaListado.extend({
  perfil: z.enum(['con_usuario', 'sin_usuario', 'estudiante', 'docente']).optional(),
});

export type ConsultaPersonas = z.infer<typeof consultaPersonas>;

export interface FilaPersona {
  id: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  documentos: string;
  usuario_id: string | null;
  usuario_login: string | null;
  usuario_estado: string | null;
  es_estudiante: boolean;
  es_docente: boolean;
}

export interface DocumentoPersona {
  id: string;
  tipo: string;
  pais_emisor: string;
  numero: string;
  verificado_en: string | null;
}

export interface DetallePersona {
  id: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  direccion: string | null;
  creado_en: string;
  documentos: DocumentoPersona[];
  usuario: { id: string; login: string; estado: string } | null;
  es_estudiante: boolean;
  es_docente: boolean;
}
