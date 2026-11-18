import { z } from 'zod';
import { consultaListado, fecha, fechaOpcional, id, idOpcional, textoRequerido } from '../comunes';

// Registro y corrección manual de asistencia (diaria por sección, por sesión de clase y de docentes)
// y resúmenes para los portales.

export const ESTADOS_ASISTENCIA = ['pendiente', 'presente', 'tarde', 'ausente', 'justificado'] as const;
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

/** Estados que se registran o corrigen a mano ("justificado" solo lo pone una justificación aprobada). */
export const ESTADOS_MANUALES = ['presente', 'tarde', 'ausente'] as const;
export type EstadoManual = (typeof ESTADOS_MANUALES)[number];

export const ETIQUETA_ESTADO: Record<EstadoAsistencia, string> = {
  pendiente: 'Pendiente',
  presente: 'Presente',
  tarde: 'Tarde',
  ausente: 'Ausente',
  justificado: 'Justificado',
};

const registroAlumno = z.object({ matriculaId: id, estado: z.enum(ESTADOS_MANUALES) });

export const esquemaRegistroDiario = z.object({
  jornadaId: id,
  motivo: textoRequerido(300),
  registros: z.array(registroAlumno).min(1, 'No hay cambios que guardar').max(200),
});
export type DatosRegistroDiario = z.infer<typeof esquemaRegistroDiario>;

export const esquemaRegistroSesion = z.object({
  motivo: textoRequerido(300),
  registros: z.array(registroAlumno).min(1, 'No hay cambios que guardar').max(200),
});
export type DatosRegistroSesion = z.infer<typeof esquemaRegistroSesion>;

export const esquemaRegistroDocente = z.object({
  jornadaId: id,
  estado: z.enum(ESTADOS_MANUALES),
  motivo: textoRequerido(300),
});
export type DatosRegistroDocente = z.infer<typeof esquemaRegistroDocente>;

export interface ResultadoLote {
  guardados: number;
  sinCambios: number;
  errores: { matriculaId: string; estudiante: string | null; mensaje: string }[];
}

export const consultaDiariaSeccion = consultaListado.extend({ seccionId: id, fecha });
export const consultaSesionesSeccion = z.object({ seccionId: idOpcional, fecha });
export const consultaListadoSesion = consultaListado;
export const consultaDiariaDocentes = consultaListado.extend({
  fecha,
  estado: z.enum(ESTADOS_ASISTENCIA).optional(),
});

export interface JornadaSeccionInfo {
  id: string;
  fecha: string;
  entrada: string;
  salida: string;
  seccion: string;
  admite_qr: boolean;
  admite_manual: boolean;
  tolerancia_minutos: number;
}

export interface FilaAsistenciaAlumno {
  matricula_id: string;
  estudiante_id: string;
  codigo: string;
  estudiante: string;
  asistencia_id: string | null;
  estado: EstadoAsistencia;
  entrada: string | null;
  salida: string | null;
  motivo: string | null;
  justificacion: string | null;
}

export interface FilaSesion {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  curso: string;
  seccion: string;
  docente: string;
  registrados: number;
}

export interface SesionInfo extends FilaSesion {
  seccion_id: string;
  jornada_id: string | null;
  admite_manual: boolean;
}

export interface FilaAsistenciaDocente {
  jornada_id: string;
  docente_id: string;
  codigo: string;
  docente: string;
  hora_entrada: string;
  hora_salida: string;
  asistencia_id: string | null;
  estado: EstadoAsistencia;
  entrada: string | null;
  salida: string | null;
  motivo: string | null;
  justificacion: string | null;
}

// ── Portales (alumno, apoderado, docente) ────────────────────────────────────

export const consultaResumen = z
  .object({ desde: fechaOpcional, hasta: fechaOpcional })
  .refine((d) => !d.desde || !d.hasta || d.hasta >= d.desde, { message: 'Rango de fechas inválido', path: ['hasta'] });

export const consultaResumenHijo = z
  .object({ estudianteId: id, desde: fechaOpcional, hasta: fechaOpcional })
  .refine((d) => !d.desde || !d.hasta || d.hasta >= d.desde, { message: 'Rango de fechas inválido', path: ['hasta'] });

export interface FilaDetalleAsistencia {
  asistencia_id: string | null;
  fecha: string;
  estado: EstadoAsistencia;
  entrada: string | null;
  salida: string | null;
  /** Para asistencias por sesión de clase. */
  curso: string | null;
  hora_inicio: string | null;
  justificacion_estado: string | null;
  /** Se puede solicitar justificación (ausente/tarde sin solicitud vigente). */
  justificable: boolean;
}

export interface FilaJustificacionPropia {
  id: string;
  fecha: string;
  estado_asistencia: string;
  curso: string | null;
  motivo: string;
  estado: string;
  solicitada_en: string;
  solicitante: string;
  decision: string | null;
  resuelta_en: string | null;
  tiene_evidencia: boolean;
}

export interface ResumenAsistencia {
  totales: Record<EstadoAsistencia, number>;
  /** (presente + tarde + justificado) / días con registro, en %. */
  porcentaje: number | null;
  diaria: FilaDetalleAsistencia[];
  sesiones: FilaDetalleAsistencia[];
  justificaciones: FilaJustificacionPropia[];
}
