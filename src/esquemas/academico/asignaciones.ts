import { z } from 'zod';
import { booleano, consultaListado, fecha, id, idOpcional } from '../comunes';

export const FUNCIONES_DOCENTE = ['titular', 'reemplazo', 'apoyo'] as const;
export type FuncionDocente = (typeof FUNCIONES_DOCENTE)[number];

export const NOMBRE_FUNCION: Record<string, string> = { titular: 'Titular', reemplazo: 'Reemplazo', apoyo: 'Apoyo' };

const conVigencia = <T extends { inicio: string; fin: string }>(d: T) => d.fin >= d.inicio;
const mensajeVigencia = { message: 'El fin debe ser posterior al inicio', path: ['fin'] };

export const esquemaAsignacion = z
  .object({
    cursoId: id,
    docenteId: id,
    funcion: z.enum(FUNCIONES_DOCENTE),
    inicio: fecha,
    fin: fecha,
  })
  .refine(conVigencia, mensajeVigencia);

export type DatosAsignacion = z.infer<typeof esquemaAsignacion>;

export const esquemaActualizarAsignacion = z
  .object({ funcion: z.enum(FUNCIONES_DOCENTE), inicio: fecha, fin: fecha })
  .refine(conVigencia, mensajeVigencia);

export type DatosActualizarAsignacion = z.infer<typeof esquemaActualizarAsignacion>;

export const esquemaEstadoCurso = z.object({ activo: booleano });

export const consultaCursos = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  seccionId: idOpcional,
  sinDocente: z.enum(['true', 'false']).optional(),
});

export const consultaAsignaciones = consultaListado.extend({
  anioId: idOpcional,
  seccionId: idOpcional,
  cursoId: idOpcional,
  docenteId: idOpcional,
  funcion: z.enum(FUNCIONES_DOCENTE).optional(),
});

export interface FilaCurso {
  id: string;
  seccion_id: string;
  seccion: string;
  anio: number;
  asignatura_id: string;
  asignatura: string;
  asignatura_codigo: string;
  plan_id: string;
  plan_version: number;
  plan_inicio: string | null;
  plan_fin: string | null;
  activo: boolean;
  docentes: string;
  asignaciones: number;
}

export interface FilaAsignacion {
  id: string;
  curso_id: string;
  seccion_id: string;
  seccion: string;
  asignatura: string;
  docente_id: string;
  docente: string;
  docente_codigo: string;
  funcion: string;
  inicio: string | null;
  fin: string | null;
  vigente: boolean;
  bloques: number;
}
