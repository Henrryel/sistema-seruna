import 'server-only';
import { NotFoundError } from '@/server/errores';
import type { Actor } from '@/server/auth/actor';
import {
  cursosDelDocente,
  docenteDelActor,
  estudianteDelActor,
  exigirAccesoEstudiante,
  hijosDelApoderado,
} from '@/server/autorizacion/alcance';
import * as repo from '@/server/repositories/dashboard/dashboard';
import { hoyLima } from '@/lib/formato';
import type { InicioDocente, InicioEstudiante } from '@/esquemas/dashboard/dashboard';

// Páginas de inicio de los portales docente, estudiante y padres. El ALCANCE se aplica aquí:
// docente → solo lo suyo; alumno → su registro; apoderado → hijo vigente y según acceso académico/económico.

export async function inicioDocente(actor: Actor): Promise<InicioDocente> {
  const { docenteId } = await docenteDelActor(actor);
  const hoy = hoyLima();
  const sesiones = await repo.sesionesDelDia(docenteId, hoy);
  const clases = sesiones.length ? sesiones : await repo.bloquesDelDia(docenteId, hoy);
  const pendientes = await repo.calificacionesPendientes(docenteId);
  const cursos = await cursosDelDocente(actor, hoy);
  return { fecha: hoy, origenClases: sesiones.length ? 'sesiones' : 'horario', clases, pendientes, cursos: cursos.length };
}

async function resumenEstudiante(estudianteId: string, acceso: { academico: boolean; economico: boolean }): Promise<InicioEstudiante> {
  const e = await repo.datosEstudiante(estudianteId);
  if (!e) throw new NotFoundError('El estudiante no existe');
  const hoy = hoyLima();
  const matricula = await repo.matriculaActual(estudianteId, hoy);
  const inicioMes = `${hoy.slice(0, 8)}01`;
  return {
    estudiante: { id: e.id, codigo: e.codigo, nombres: e.nombres, apellidos: e.apellidos },
    matricula,
    accesoAcademico: acceso.academico,
    accesoEconomico: acceso.economico,
    logros: acceso.academico && matricula ? await repo.ultimosLogros(matricula.id) : null,
    asistencia:
      acceso.academico && matricula
        ? { desde: inicioMes, hasta: hoy, ...(await repo.asistenciaMatricula(matricula.id, inicioMes, hoy)) }
        : null,
    deuda: acceso.economico ? await repo.deudaEstudiante(estudianteId, hoy) : null,
  };
}

export async function inicioEstudiante(actor: Actor): Promise<InicioEstudiante> {
  const { estudianteId } = await estudianteDelActor(actor);
  return resumenEstudiante(estudianteId, { academico: true, economico: true });
}

/** Resumen del hijo: exige vínculo vigente; lo académico y lo económico según los flags del vínculo. */
export async function inicioPadre(actor: Actor, estudianteId: string): Promise<InicioEstudiante> {
  await exigirAccesoEstudiante(actor, estudianteId, { portal: 'padre', tipo: 'basico' });
  const hijo = (await hijosDelApoderado(actor)).find((h) => h.estudianteId === estudianteId);
  return resumenEstudiante(estudianteId, { academico: Boolean(hijo?.accesoAcademico), economico: Boolean(hijo?.accesoEconomico) });
}
