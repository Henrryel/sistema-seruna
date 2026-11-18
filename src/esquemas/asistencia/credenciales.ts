import { z } from 'zod';
import { consultaListado, fecha, id, idOpcional, textoRequerido } from '../comunes';

// Credenciales QR / Code 128. El token solo existe al emitir (se imprime en ese momento);
// la base guarda únicamente su SHA-256.

export const MODOS_EMISION = ['personas', 'seccion', 'docentes'] as const;
export type ModoEmision = (typeof MODOS_EMISION)[number];

export const esquemaEmitirCredenciales = z
  .object({
    modo: z.enum(MODOS_EMISION),
    /** modo `personas`: personas (alumnos o docentes) elegidas. */
    personaIds: z.array(id).max(300).default([]),
    /** modo `seccion`: todos los alumnos con matrícula vigente o futura en la sección. */
    seccionId: idOpcional,
    /** modo `docentes`: docentes elegidos (vacío = todos los activos). */
    docenteIds: z.array(id).max(500).default([]),
    /** Último día de validez (inclusive). */
    expiraEn: fecha,
  })
  .refine((d) => d.modo !== 'personas' || d.personaIds.length > 0, { message: 'Seleccione al menos una persona', path: ['personaIds'] })
  .refine((d) => d.modo !== 'seccion' || Boolean(d.seccionId), { message: 'Seleccione la sección', path: ['seccionId'] });

export type DatosEmitirCredenciales = z.infer<typeof esquemaEmitirCredenciales>;

export const ESTADOS_CREDENCIAL = ['vigente', 'vencida', 'revocada'] as const;
export type EstadoCredencial = (typeof ESTADOS_CREDENCIAL)[number];

export const consultaCredenciales = consultaListado.extend({
  estado: z.enum(ESTADOS_CREDENCIAL).optional(),
  perfil: z.enum(['alumno', 'docente']).optional(),
});

export interface FilaCredencial {
  id: string;
  persona_id: string;
  persona: string;
  perfil: string;
  codigo: string | null;
  emitida_en: string;
  expira_en: string;
  revocada_en: string | null;
  emitida_por: string;
  estado: EstadoCredencial;
}

export const consultaPersonasCredencial = z.object({
  q: z.string().trim().min(2, 'Escriba al menos 2 caracteres').max(80),
  perfil: z.enum(['alumno', 'docente']).optional(),
});

export interface PersonaCredencial {
  persona_id: string;
  nombre: string;
  perfil: 'alumno' | 'docente';
  codigo: string;
  detalle: string | null;
  credencial_vigente: boolean;
}

export const esquemaRevocarCredencial = z.object({ motivo: textoRequerido(300) });
