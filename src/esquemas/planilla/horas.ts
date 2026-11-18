// Esquemas compartidos (front/back) de horas docentes.
import { z } from 'zod';
import { consultaListado, fecha, fechaOpcional, hora, id, idOpcional, textoRequerido } from '../comunes';

export const ESTADOS_HORA = ['pendiente', 'aprobada', 'rechazada'] as const;
export type EstadoHora = (typeof ESTADOS_HORA)[number];

export const OPCIONES_ESTADO_HORA = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'aprobada', etiqueta: 'Aprobada' },
  { valor: 'rechazada', etiqueta: 'Rechazada' },
];

export const esquemaHora = z
  .object({
    contratoId: id,
    fecha,
    horaInicio: hora,
    horaFin: hora,
    motivo: textoRequerido(300),
    sesionId: idOpcional,
  })
  .refine((d) => d.horaFin > d.horaInicio, {
    message: 'La hora de fin debe ser posterior al inicio',
    path: ['horaFin'],
  });

export type DatosHora = z.infer<typeof esquemaHora>;

export const esquemaResolverHora = z.object({
  estado: z.enum(['aprobada', 'rechazada']),
  decision: textoRequerido(300),
});

export type DatosResolverHora = z.infer<typeof esquemaResolverHora>;

export const consultaHoras = consultaListado.extend({
  estado: z.enum(ESTADOS_HORA).optional(),
  contratoId: idOpcional,
  docenteId: idOpcional,
  desde: fechaOpcional,
  hasta: fechaOpcional,
});

export const consultaSesiones = z.object({ contratoId: id, fecha });

export interface FilaHora {
  id: string;
  contrato_id: string;
  referencia: string;
  docente_id: string;
  docente: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  minutos: number;
  motivo: string;
  sesion_id: string | null;
  sesion: string | null;
  evidencia_id: string | null;
  estado: EstadoHora;
  decision: string | null;
  registrado_en: string;
  resuelto_en: string | null;
  /** Liquidación en la que ya se incluyó (si la hay). */
  liquidacion_id: string | null;
}

export interface OpcionSesion {
  valor: string;
  etiqueta: string;
  extra: { horaInicio: string; horaFin: string };
}

/** Minutos → '2 h 15 min'. */
export function textoMinutos(minutos: number | string | null | undefined): string {
  const m = Number(minutos ?? 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h} h ${r} min`;
  if (h) return `${h} h`;
  return `${r} min`;
}
