import { z } from 'zod';
import { fechaOpcional, idOpcional, textoOpcional, textoRequerido } from '../comunes';

// Catálogos fijos del dominio de matrícula (los que la base restringe con CHECK) y bloques reutilizables.

export const TIPOS_INGRESO = ['nuevo', 'continuidad', 'traslado'] as const;
export const ESTADOS_MATRICULA = ['solicitada', 'activa', 'retirada', 'trasladada', 'anulada'] as const;
export const TIPOS_VACANTE = ['regular', 'reservada'] as const;
export const TIPOS_MOVIMIENTO = ['confirmacion', 'cambio_seccion', 'traslado', 'retiro', 'reincorporacion', 'anulacion'] as const;
export const ESTADOS_DOCUMENTO_EXPEDIENTE = ['pendiente', 'validado', 'observado', 'reemplazado'] as const;
export const TIPOS_DOCUMENTO_INSTITUCIONAL = ['reglamento', 'contrato', 'condiciones_economicas'] as const;

// Sin CHECK en la base (texto libre): valores sugeridos por la app.
export const TIPOS_DOCUMENTO_IDENTIDAD = ['DNI', 'CE', 'PASAPORTE', 'PTP', 'CPP', 'OTRO'] as const;
export const TIPOS_DOCUMENTO_RESPONSABLE = ['DNI', 'RUC', 'CE', 'PASAPORTE', 'OTRO'] as const;
export const PARENTESCOS = ['madre', 'padre', 'tutor', 'abuelo', 'abuela', 'tio', 'tia', 'hermano', 'hermana', 'otro'] as const;
export const METODOS_ACEPTACION = ['firma_fisica', 'firma_digital', 'presencial'] as const;

export type TipoIngreso = (typeof TIPOS_INGRESO)[number];
export type EstadoMatricula = (typeof ESTADOS_MATRICULA)[number];

export const ETIQUETAS: Record<string, string> = {
  nuevo: 'Nuevo',
  continuidad: 'Continuidad',
  traslado: 'Traslado',
  solicitada: 'Solicitada',
  activa: 'Activa',
  retirada: 'Retirada',
  trasladada: 'Trasladada',
  anulada: 'Anulada',
  regular: 'Regular',
  reservada: 'Reservada',
  confirmacion: 'Confirmación',
  cambio_seccion: 'Cambio de sección',
  retiro: 'Retiro',
  reincorporacion: 'Reincorporación',
  anulacion: 'Anulación',
  pendiente: 'Pendiente',
  validado: 'Validado',
  observado: 'Observado',
  reemplazado: 'Reemplazado',
  reglamento: 'Reglamento interno',
  contrato: 'Contrato de servicios',
  condiciones_economicas: 'Condiciones económicas',
  madre: 'Madre',
  padre: 'Padre',
  tutor: 'Tutor(a) legal',
  abuelo: 'Abuelo',
  abuela: 'Abuela',
  tio: 'Tío',
  tia: 'Tía',
  hermano: 'Hermano',
  hermana: 'Hermana',
  otro: 'Otro',
  firma_fisica: 'Firma física',
  firma_digital: 'Firma digital',
  presencial: 'Aceptación presencial',
  PASAPORTE: 'Pasaporte',
  CE: 'Carné de extranjería',
  PTP: 'PTP',
  CPP: 'CPP',
  DNI: 'DNI',
  RUC: 'RUC',
  OTRO: 'Otro',
};

export const etiqueta = (v: string | null | undefined) => (v ? (ETIQUETAS[v] ?? v) : '—');
export const opciones = (valores: readonly string[]) => valores.map((v) => ({ valor: v, etiqueta: etiqueta(v) }));

/** Correo opcional ('' → null). */
export const correoOpcional = z
  .union([z.literal(''), z.null(), z.string().trim().email('Correo inválido').max(120)])
  .optional()
  .transform((v) => (v ? v : null));

/** Entero opcional desde un input ('' → null). */
export const enteroOpcional = z
  .union([z.literal(''), z.null(), z.coerce.number().int('Debe ser un número entero')])
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v));

/** Datos básicos de una persona (tabla personas). */
export const esquemaPersonaBasica = z.object({
  nombres: textoRequerido(120),
  apellidos: textoRequerido(120),
  fechaNacimiento: fechaOpcional,
  correo: correoOpcional,
  telefono: textoOpcional(30),
  direccion: textoOpcional(200),
});

/** Documento de identidad (la base valida DNI = 8 dígitos y país PE, y la unicidad). */
export const esquemaDocumentoIdentidad = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO_IDENTIDAD),
  numero: z.string().trim().min(1, 'Requerido').max(20, 'Máximo 20 caracteres').transform((v) => v.toUpperCase()),
  paisEmisor: z
    .union([z.literal(''), z.null(), z.string().trim().regex(/^[A-Za-z]{2}$/, 'Código de país de 2 letras')])
    .optional()
    .transform((v) => (v ? v.toUpperCase() : 'PE')),
});

export type DatosDocumentoIdentidad = z.infer<typeof esquemaDocumentoIdentidad>;

/** Persona nueva con documento de identidad opcional. */
export const esquemaPersonaNueva = esquemaPersonaBasica.extend({
  documentoTipo: z.union([z.literal(''), z.enum(TIPOS_DOCUMENTO_IDENTIDAD)]).optional(),
  documentoNumero: textoOpcional(20),
  documentoPais: z
    .union([z.literal(''), z.null(), z.string().trim().regex(/^[A-Za-z]{2}$/, 'Código de país de 2 letras')])
    .optional()
    .transform((v) => (v ? v.toUpperCase() : 'PE')),
});

export type DatosPersonaNueva = z.infer<typeof esquemaPersonaNueva>;

/**
 * Persona existente (`personaId`) o nueva (`persona`). Si se elige una existente, los campos de la
 * persona nueva se ignoran.
 */
export function conPersona<T extends z.ZodRawShape>(forma: T) {
  return z
    .preprocess(
      (v) => (v && typeof v === 'object' && (v as { personaId?: unknown }).personaId ? { ...(v as object), persona: undefined } : v),
      z.object({ personaId: idOpcional, persona: esquemaPersonaNueva.optional() }).extend(forma),
    )
    .superRefine((d, ctx) => {
      const datos = d as { personaId?: string; persona?: unknown };
      if (!datos.personaId && !datos.persona) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['persona', 'nombres'], message: 'Seleccione una persona o registre una nueva' });
      }
    });
}

export interface ReferenciaPersona {
  personaId?: string;
  persona?: DatosPersonaNueva;
}

export interface PersonaEncontrada {
  id: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  telefono: string | null;
  documentos: string | null;
  estudiante_id: string | null;
}
