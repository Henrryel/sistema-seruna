import 'server-only';
import { cursosDelDocente, docenteDelActor, estudianteDelActor, exigirAccesoEstudiante } from '@/server/autorizacion/alcance';
import * as repo from '@/server/repositories/academico/horarios';
import { hoyLima } from '@/lib/formato';
import type { Actor } from '@/server/auth/actor';
import type { BloqueHorario } from '@/esquemas/academico/horarios';

// Vistas de portal (docente, estudiante, padre) con alcance de datos: cada actor solo ve lo suyo.

export interface CursoDocente {
  asignacion_id: string;
  curso_id: string;
  funcion: string;
  asignatura: string;
  seccion_id: string;
  seccion: string;
  grado: number;
  nivel: string;
  alumnos: number;
}

export interface AsignacionDocente {
  asignacion_id: string;
  curso_id: string;
  funcion: string;
  asignatura: string;
  seccion: string;
  anio: number;
  inicio: string | null;
  fin: string | null;
}

export interface HorarioPortal {
  fecha: string;
  seccion: { id: string; etiqueta: string; turno: string } | null;
  bloques: BloqueHorario[];
}

/** Cursos del docente vigentes en la fecha (alcance: sus asignaciones) y el resto de su historial. */
export async function misCursos(actor: Actor, fecha?: string) {
  const dia = fecha ?? hoyLima();
  const vigentes = await cursosDelDocente(actor, dia);
  const { docenteId } = await docenteDelActor(actor);
  const [todas, alumnos] = await Promise.all([
    repo.asignacionesDeDocente(docenteId),
    repo.alumnosPorSeccion([...new Set(vigentes.map((c) => c.seccion_id))], dia),
  ]);
  const cursos: CursoDocente[] = vigentes.map((c) => ({
    asignacion_id: c.asignacion_id,
    curso_id: c.curso_id,
    funcion: c.funcion,
    asignatura: c.asignatura,
    seccion_id: c.seccion_id,
    seccion: c.seccion,
    grado: c.grado,
    nivel: c.nivel,
    alumnos: alumnos.get(c.seccion_id) ?? 0,
  }));
  const otras: AsignacionDocente[] = todas.filter((a) => !vigentes.some((v) => v.asignacion_id === a.asignacion_id));
  return { fecha: dia, cursos, otras };
}

/** Horario semanal del docente (solo sus bloques). */
export async function horarioDocente(actor: Actor, fecha?: string): Promise<HorarioPortal> {
  const { docenteId } = await docenteDelActor(actor);
  const dia = fecha ?? hoyLima();
  return { fecha: dia, seccion: null, bloques: await repo.bloquesDeDocente(docenteId, dia) };
}

async function horarioDeEstudiante(estudianteId: string, fecha?: string): Promise<HorarioPortal> {
  const ubicacion = await repo.seccionDeEstudiante(estudianteId, fecha);
  if (!ubicacion) return { fecha: fecha ?? hoyLima(), seccion: null, bloques: [] };
  const [seccion, bloques] = await Promise.all([
    repo.etiquetaSeccion(ubicacion.seccion_id),
    repo.bloquesDeSeccion(ubicacion.seccion_id, ubicacion.fecha),
  ]);
  return {
    fecha: ubicacion.fecha,
    seccion: seccion ? { id: ubicacion.seccion_id, etiqueta: seccion.etiqueta, turno: seccion.turno } : null,
    bloques,
  };
}

/** Horario del propio estudiante (sección de su matrícula vigente). */
export async function horarioEstudiante(actor: Actor, fecha?: string) {
  const { estudianteId } = await estudianteDelActor(actor);
  return horarioDeEstudiante(estudianteId, fecha);
}

/** Horario de un hijo: exige vínculo vigente con el apoderado (acceso básico). */
export async function horarioHijo(actor: Actor, estudianteId: string, fecha?: string) {
  await exigirAccesoEstudiante(actor, estudianteId, { portal: 'padre', tipo: 'basico' });
  return horarioDeEstudiante(estudianteId, fecha);
}
