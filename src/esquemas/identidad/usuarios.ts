import { z } from 'zod';
import { booleano, consultaListado, id, textoOpcional } from '../comunes';

export const ESTADOS_USUARIO = ['pendiente', 'activo', 'suspendido'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

/** Login normalizado (la base exige minúsculas y sin espacios en los extremos). */
export const login = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Mínimo 3 caracteres')
  .max(60, 'Máximo 60 caracteres')
  .regex(/^[a-z0-9._@-]+$/, 'Use solo letras sin tildes, números, punto, guion, guion bajo o @');

const codigoRol = z.string().trim().min(1).max(40);

export const esquemaCrearUsuario = z.object({
  personaId: z.coerce.string().trim().min(1, 'Seleccione una persona').pipe(id),
  login,
  roles: z.array(codigoRol).min(1, 'Seleccione al menos un rol').max(10),
  /** Generar el enlace de activación al crear la cuenta (se muestra una sola vez). */
  generarEnlace: booleano.default(true),
});

export type DatosCrearUsuario = z.infer<typeof esquemaCrearUsuario>;

export const esquemaRolesUsuario = z.object({ roles: z.array(codigoRol).max(10) });

export const esquemaEstadoUsuario = z
  .object({
    estado: z.enum(['activo', 'suspendido']),
    motivo: textoOpcional(300),
  })
  .refine((d) => d.estado !== 'suspendido' || (d.motivo ?? '').length >= 3, {
    message: 'Indique el motivo de la suspensión',
    path: ['motivo'],
  });

export const esquemaEnlaceAcceso = z.object({
  proposito: z.enum(['activacion', 'recuperacion']).optional(),
  horasVigencia: z.coerce.number().int().min(1).max(168).default(72),
});

export const consultaUsuarios = consultaListado.extend({
  estado: z.enum(ESTADOS_USUARIO).optional(),
  rol: z.string().trim().max(40).optional(),
});

export type ConsultaUsuarios = z.infer<typeof consultaUsuarios>;

export interface FilaUsuario {
  id: string;
  login: string;
  estado: string;
  persona_id: string;
  nombres: string;
  apellidos: string;
  roles: string[];
  roles_texto: string;
  ultimo_acceso: string | null;
  sesiones_activas: number;
  tiene_contrasena: boolean;
}

export interface RolDisponible {
  id: string;
  codigo: string;
  nombre: string;
  permisos: string[];
}

export interface DetalleUsuario extends FilaUsuario {
  correo_contacto: string | null;
  sesiones: { id: string; creada_en: string; expira_en: string }[];
  tokens: { id: string; proposito: string; emitido_en: string; expira_en: string; emisor: string | null }[];
  permisos: string[];
}

export interface EnlaceAcceso {
  url: string;
  expiraEn: string;
  proposito: 'activacion' | 'recuperacion';
}

export const NOMBRE_ESTADO_USUARIO: Record<string, string> = {
  pendiente: 'Pendiente de activación',
  activo: 'Activo',
  suspendido: 'Suspendido',
};
