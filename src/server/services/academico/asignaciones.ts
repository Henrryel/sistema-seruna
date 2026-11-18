import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/academico/asignaciones';
import { rango } from '@/server/repositories/academico/comunes';
import type { Actor } from '@/server/auth/actor';
import type { DatosActualizarAsignacion, DatosAsignacion } from '@/esquemas/academico/asignaciones';
import { conMensajes } from './restricciones';

// Cursos de sección y asignaciones docentes. La base valida la vigencia dentro del plan de la sección
// (trigger validar_vigencia_horario) y que el docente no se repita en el curso en el mismo período (EXCLUDE).

export const listarCursos = repo.listarCursos;
export const listarAsignaciones = repo.listarAsignaciones;

export async function cambiarEstadoCurso(actor: Actor, cursoId: string, activo: boolean) {
  return transaccion(async () => {
    const r = await repo.cambiarEstadoCurso(cursoId, activo);
    if (!r) throw new NotFoundError('El curso no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: activo ? 'activar' : 'desactivar', entidad: 'cursos_seccion', registroId: cursoId, resultado: 'ok' });
    return r;
  });
}

export async function crearAsignacion(actor: Actor, d: DatosAsignacion) {
  const curso = await repo.obtenerCurso(d.cursoId);
  if (!curso) throw new NotFoundError('El curso no existe');
  const docente = await repo.docenteExiste(d.docenteId);
  if (!docente) throw new NotFoundError('El docente no existe');
  if (!docente.activo) throw new ValidationError('El docente no está activo');
  return transaccion(async () => {
    const r = await conMensajes(() => repo.crearAsignacion({ cursoId: d.cursoId, docenteId: d.docenteId, funcion: d.funcion, vigencia: rango(d.inicio, d.fin) }));
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'crear',
      entidad: 'asignaciones_docentes',
      registroId: r.id,
      motivo: `curso ${d.cursoId}, docente ${d.docenteId} (${d.funcion})`,
      resultado: 'ok',
    });
    return r;
  });
}

export async function actualizarAsignacion(actor: Actor, id: string, d: DatosActualizarAsignacion) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.actualizarAsignacion(id, { funcion: d.funcion, vigencia: rango(d.inicio, d.fin) }));
    if (!r) throw new NotFoundError('La asignación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'asignaciones_docentes', registroId: id, motivo: `${d.funcion} ${d.inicio} – ${d.fin}`, resultado: 'ok' });
    return r;
  });
}

export async function eliminarAsignacion(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.eliminarAsignacion(id));
    if (!r) throw new NotFoundError('La asignación no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'asignaciones_docentes', registroId: id, resultado: 'ok' });
    return r;
  });
}
