import { z } from 'zod';
import { consultaListado, id, textoRequerido } from '../comunes';

// Justificaciones de inasistencia/tardanza. La base valida (solo ausente/tarde, nace pendiente,
// se resuelve una vez) y al aprobarse un trigger pasa la asistencia a "justificado".

export const ESTADOS_JUSTIFICACION = ['pendiente', 'aprobada', 'rechazada'] as const;

export const esquemaSolicitudJustificacion = z.object({
  asistenciaId: id,
  motivo: z.string().trim().min(5, 'Describa el motivo (mínimo 5 caracteres)').max(1000, 'Máximo 1000 caracteres'),
});
export type DatosSolicitudJustificacion = z.infer<typeof esquemaSolicitudJustificacion>;

/** Tipos de archivo aceptados como evidencia (certificado médico, constancia, foto). */
export const MIME_EVIDENCIA = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_BYTES_EVIDENCIA = 5 * 1024 * 1024;

export const esquemaResolverJustificacion = z.object({
  estado: z.enum(['aprobada', 'rechazada']),
  decision: textoRequerido(500),
});
export type DatosResolverJustificacion = z.infer<typeof esquemaResolverJustificacion>;

export const consultaJustificaciones = consultaListado.extend({
  estado: z.enum(ESTADOS_JUSTIFICACION).optional(),
  perfil: z.enum(['alumno', 'docente']).optional(),
});

export interface FilaJustificacion {
  id: string;
  perfil: 'alumno' | 'docente';
  persona: string;
  codigo: string;
  fecha: string;
  curso: string | null;
  estado_asistencia: string;
  motivo: string;
  evidencia_id: string | null;
  evidencia_nombre: string | null;
  estado: string;
  solicitada_en: string;
  solicitante: string;
  resuelta_en: string | null;
  resolutor: string | null;
  decision: string | null;
}
