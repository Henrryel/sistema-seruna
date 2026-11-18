import { z } from 'zod';
import { consultaListado, fecha, fechaOpcional, hora, id, idOpcional } from '../comunes';
import { idSeleccionOpcional } from './seleccion';

// Bloques de horario y sesiones de clase. Los cruces (sección, docente, aula), horas y vigencias dentro del
// plan y de la asignación los valida la base (EXCLUDE, CHECK y trigger validar_vigencia_horario).

export const DIAS_SEMANA = [
  { valor: '1', etiqueta: 'Lunes' },
  { valor: '2', etiqueta: 'Martes' },
  { valor: '3', etiqueta: 'Miércoles' },
  { valor: '4', etiqueta: 'Jueves' },
  { valor: '5', etiqueta: 'Viernes' },
  { valor: '6', etiqueta: 'Sábado' },
  { valor: '7', etiqueta: 'Domingo' },
] as const;

export const ESTADOS_SESION = ['programada', 'realizada', 'cancelada'] as const;
export type EstadoSesion = (typeof ESTADOS_SESION)[number];

const diaIso = z.coerce.number({ invalid_type_error: 'Seleccione el día' }).int().min(1, 'Seleccione el día').max(7, 'Seleccione el día');
const vigenciaValida = (d: { inicio: string; fin: string }) => d.fin >= d.inicio;
const mensajeVigencia = { message: 'El fin debe ser posterior al inicio', path: ['fin'] };
// Con horas invertidas la columna generada `franja` falla antes que el CHECK (error 22000 sin mensaje útil).
const horasValidas = (d: { horaInicio: string; horaFin: string }) => d.horaFin > d.horaInicio;
const mensajeHoras = { message: 'La hora de fin debe ser posterior a la de inicio', path: ['horaFin'] };

export const esquemaBloque = z
  .object({
    cursoId: id,
    asignacionId: id,
    aulaId: idSeleccionOpcional,
    diaIso,
    horaInicio: hora,
    horaFin: hora,
    inicio: fecha,
    fin: fecha,
  })
  .refine(vigenciaValida, mensajeVigencia)
  .refine(horasValidas, mensajeHoras);

export type DatosBloque = z.infer<typeof esquemaBloque>;

export const esquemaActualizarBloque = z
  .object({
    aulaId: idSeleccionOpcional,
    diaIso,
    horaInicio: hora,
    horaFin: hora,
    inicio: fecha,
    fin: fecha,
  })
  .refine(vigenciaValida, mensajeVigencia)
  .refine(horasValidas, mensajeHoras);

export type DatosActualizarBloque = z.infer<typeof esquemaActualizarBloque>;

export const consultaHorario = z.object({ seccionId: id, fecha: fechaOpcional });

/** Máximo de días por generación (un semestre) para mantener la operación acotada. */
export const MAX_DIAS_GENERACION = 186;

export const esquemaGenerarSesiones = z
  .object({
    seccionId: id,
    cursoId: idSeleccionOpcional,
    desde: fecha,
    hasta: fecha,
  })
  .refine((d) => d.hasta >= d.desde, { message: 'El fin debe ser posterior al inicio', path: ['hasta'] })
  .refine((d) => (Date.parse(d.hasta) - Date.parse(d.desde)) / 86_400_000 <= MAX_DIAS_GENERACION, {
    message: `El rango no puede superar ${MAX_DIAS_GENERACION} días`,
    path: ['hasta'],
  });

export type DatosGenerarSesiones = z.infer<typeof esquemaGenerarSesiones>;

export const esquemaSesion = z
  .object({
    asignacionId: id,
    bloqueId: idOpcional,
    aulaId: idSeleccionOpcional,
    fecha,
    horaInicio: hora,
    horaFin: hora,
  })
  .refine(horasValidas, mensajeHoras);

export type DatosSesion = z.infer<typeof esquemaSesion>;

export const esquemaEstadoSesion = z.object({ estado: z.enum(ESTADOS_SESION) });

export const consultaSesiones = consultaListado.extend({
  anioId: idOpcional,
  seccionId: idOpcional,
  cursoId: idOpcional,
  estado: z.enum(ESTADOS_SESION).optional(),
  desde: fechaOpcional,
  hasta: fechaOpcional,
});

export interface BloqueHorario {
  id: string;
  seccion_id: string;
  seccion: string;
  curso_id: string;
  asignacion_id: string;
  asignatura: string;
  docente_id: string;
  docente: string;
  aula_id: string | null;
  aula: string | null;
  dia_iso: number;
  hora_inicio: string;
  hora_fin: string;
  inicio: string | null;
  fin: string | null;
}

export interface HorarioSemanal {
  fecha: string;
  bloques: BloqueHorario[];
}

export interface FilaSesion {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  curso_id: string;
  asignatura: string;
  seccion_id: string;
  seccion: string;
  docente: string;
  aula: string | null;
  bloque_id: string | null;
}

export interface ResultadoGeneracion {
  creadas: number;
  existentes: number;
  omitidas: { fecha: string; asignatura: string; motivo: string }[];
  diasSinClase: number;
}
