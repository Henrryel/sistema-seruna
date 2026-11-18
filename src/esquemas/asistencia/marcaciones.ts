import { z } from 'zod';
import { id, uuid } from '../comunes';

// Marcaciones desde el escáner (QR/Code 128 por cámara o lector USB) y sincronización offline.

export const TIPOS_MARCACION = ['entrada', 'salida'] as const;
export type TipoMarcacion = (typeof TIPOS_MARCACION)[number];

/** Texto leído del QR / Code 128 (el servidor lo normaliza antes de calcular el hash). */
export const codigoLeido = z.string().trim().min(4, 'Lectura incompleta').max(200, 'Lectura demasiado larga');

export const esquemaMarcar = z.object({
  eventoUuid: uuid,
  tipo: z.enum(TIPOS_MARCACION),
  lectorId: id,
  codigo: codigoLeido,
});

export type DatosMarcar = z.infer<typeof esquemaMarcar>;

export const esquemaEventoOffline = esquemaMarcar.extend({
  /** Instante en que el dispositivo capturó la lectura (ISO 8601 con zona). */
  capturadoEn: z.string().datetime({ offset: true, message: 'Instante inválido' }),
});

export type EventoOffline = z.infer<typeof esquemaEventoOffline>;

export const MAX_EVENTOS_SINCRONIZACION = 200;

export const esquemaSincronizar = z.object({
  eventos: z.array(esquemaEventoOffline).min(1).max(MAX_EVENTOS_SINCRONIZACION),
});

export interface ResultadoMarcacion {
  eventoUuid: string;
  marcacionId: string;
  tipo: TipoMarcacion;
  metodo: 'qr' | 'manual';
  /** ISO 8601. */
  instante: string;
  persona: {
    id: string;
    nombre: string;
    perfil: 'alumno' | 'docente' | null;
    codigo: string | null;
    detalle: string | null;
  };
  asistencia: {
    registrada: boolean;
    estado: string | null;
    mensaje: string;
  };
}

export interface ResultadoSincronizacion {
  eventoUuid: string;
  ok: boolean;
  /** true: no reintentar (registrado o rechazado definitivamente). */
  definitivo: boolean;
  resultado?: ResultadoMarcacion;
  error?: string;
}

export interface LectorEscaner {
  id: string;
  codigo: string;
  nombre: string;
}
