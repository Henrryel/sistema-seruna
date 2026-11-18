import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/academico/curriculo';
import type { Actor } from '@/server/auth/actor';
import type { DatosArea, DatosAsignatura, DatosCapacidad, DatosCompetencia } from '@/esquemas/academico/curriculo';
import { conMensajes } from './restricciones';

// Currículo (CNEB): áreas, asignaturas, competencias versionadas y capacidades. Las eliminaciones las
// rechaza la base si hay registros relacionados (FK).

export const listarAreas = repo.listarAreas;
export const listarAsignaturas = repo.listarAsignaturas;
export const listarCompetencias = repo.listarCompetencias;

type Entidad = 'areas_curriculares' | 'asignaturas' | 'competencias' | 'capacidades';

const NO_EXISTE: Record<Entidad, string> = {
  areas_curriculares: 'El área curricular no existe',
  asignaturas: 'La asignatura no existe',
  competencias: 'La competencia no existe',
  capacidades: 'La capacidad no existe',
};

/** Ejecuta la operación con traducción de restricciones, verifica existencia y audita. */
async function operar<T extends { id: string } | undefined>(
  actor: Actor,
  entidad: Entidad,
  accion: 'crear' | 'actualizar' | 'eliminar',
  fn: () => Promise<T>,
  registroId?: string,
) {
  return transaccion(async () => {
    const r = await conMensajes(fn);
    if (!r) throw new NotFoundError(NO_EXISTE[entidad]);
    await registrarBitacora({ actorId: actor.usuarioId, accion, entidad, registroId: registroId ?? r.id, resultado: 'ok' });
    return r;
  });
}

export const crearArea = (actor: Actor, d: DatosArea) => operar(actor, 'areas_curriculares', 'crear', () => repo.crearArea(d));
export const actualizarArea = (actor: Actor, id: string, d: DatosArea) => operar(actor, 'areas_curriculares', 'actualizar', () => repo.actualizarArea(id, d), id);
export const eliminarArea = (actor: Actor, id: string) => operar(actor, 'areas_curriculares', 'eliminar', () => repo.eliminarArea(id), id);

export const crearAsignatura = (actor: Actor, d: DatosAsignatura) => operar(actor, 'asignaturas', 'crear', () => repo.crearAsignatura(d));
export const actualizarAsignatura = (actor: Actor, id: string, d: DatosAsignatura) =>
  operar(actor, 'asignaturas', 'actualizar', () => repo.actualizarAsignatura(id, d), id);
export const eliminarAsignatura = (actor: Actor, id: string) => operar(actor, 'asignaturas', 'eliminar', () => repo.eliminarAsignatura(id), id);

export const crearCompetencia = (actor: Actor, d: DatosCompetencia) => operar(actor, 'competencias', 'crear', () => repo.crearCompetencia(d));
export const actualizarCompetencia = (actor: Actor, id: string, d: DatosCompetencia) =>
  operar(actor, 'competencias', 'actualizar', () => repo.actualizarCompetencia(id, d), id);
export const eliminarCompetencia = (actor: Actor, id: string) => operar(actor, 'competencias', 'eliminar', () => repo.eliminarCompetencia(id), id);

export async function listarCapacidades(competenciaId: string) {
  const c = await repo.obtenerCompetencia(competenciaId);
  if (!c) throw new NotFoundError(NO_EXISTE.competencias);
  return { competencia: c, capacidades: await repo.listarCapacidades(competenciaId) };
}

export async function crearCapacidad(actor: Actor, competenciaId: string, d: DatosCapacidad) {
  const c = await repo.obtenerCompetencia(competenciaId);
  if (!c) throw new NotFoundError(NO_EXISTE.competencias);
  return operar(actor, 'capacidades', 'crear', () => repo.crearCapacidad(competenciaId, d));
}

export const actualizarCapacidad = (actor: Actor, id: string, d: DatosCapacidad) =>
  operar(actor, 'capacidades', 'actualizar', () => repo.actualizarCapacidad(id, d), id);
export const eliminarCapacidad = (actor: Actor, id: string) => operar(actor, 'capacidades', 'eliminar', () => repo.eliminarCapacidad(id), id);
