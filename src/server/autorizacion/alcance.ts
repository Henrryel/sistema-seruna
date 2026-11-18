import 'server-only';
import { ForbiddenError, NotFoundError } from '@/server/errores';
import type { Actor } from '@/server/auth/actor';
import * as repo from '@/server/repositories/alcance';
import { tienePermiso } from './permisos';

// Alcance de datos (mínimo privilegio con datos de menores):
//  alumno    → solo su registro (estudiantes.persona_id)
//  apoderado → solo hijos con estudiante_apoderado vigente; académico/económico según los flags
//  docente   → solo sus asignaciones_docentes / secciones
//  admin     → todo (por permiso), siempre auditado en los servicios

export type TipoAcceso = 'basico' | 'academico' | 'economico';

export async function estudianteDelActor(actor: Pick<Actor, 'personaId'>) {
  const e = await repo.estudiantePorPersona(actor.personaId);
  if (!e) throw new ForbiddenError('Su cuenta no tiene un perfil de estudiante');
  return { estudianteId: e.estudiante_id, codigo: e.codigo, nombres: e.nombres, apellidos: e.apellidos };
}

export async function docenteDelActor(actor: Pick<Actor, 'personaId'>) {
  const d = await repo.docentePorPersona(actor.personaId);
  if (!d || !d.activo) throw new ForbiddenError('Su cuenta no tiene un perfil de docente activo');
  return { docenteId: d.docente_id, codigo: d.codigo };
}

export async function hijosDelApoderado(actor: Pick<Actor, 'personaId'>) {
  const hijos = await repo.hijosDeApoderado(actor.personaId);
  return hijos.map((h) => ({
    estudianteId: h.estudiante_id,
    codigo: h.codigo,
    nombres: h.nombres,
    apellidos: h.apellidos,
    parentesco: h.parentesco,
    accesoAcademico: h.acceso_academico,
    accesoEconomico: h.acceso_economico,
  }));
}

/**
 * Verifica que el actor pueda ver datos del estudiante desde el portal indicado.
 * - portal 'estudiante': solo su propio registro.
 * - portal 'padre': hijo con vínculo vigente y, según `tipo`, acceso_academico o acceso_economico.
 * - portal 'admin': requiere `permisoAdmin`.
 */
export async function exigirAccesoEstudiante(
  actor: Actor,
  estudianteId: string,
  opciones: { portal: 'estudiante' | 'padre' | 'admin'; tipo: TipoAcceso; permisoAdmin?: Parameters<typeof tienePermiso>[1] },
) {
  if (opciones.portal === 'admin') {
    if (!opciones.permisoAdmin || !tienePermiso(actor, opciones.permisoAdmin)) throw new ForbiddenError();
    return;
  }
  if (opciones.portal === 'estudiante') {
    const propio = await estudianteDelActor(actor);
    if (propio.estudianteId !== estudianteId) throw new ForbiddenError();
    return;
  }
  const hijo = (await hijosDelApoderado(actor)).find((h) => h.estudianteId === estudianteId);
  if (!hijo) throw new ForbiddenError('No tiene un vínculo vigente con este estudiante');
  if (opciones.tipo === 'academico' && !hijo.accesoAcademico) {
    throw new ForbiddenError('No tiene autorizado el acceso a la información académica de este estudiante');
  }
  if (opciones.tipo === 'economico' && !hijo.accesoEconomico) {
    throw new ForbiddenError('No tiene autorizado el acceso a la información de pagos de este estudiante');
  }
}

/** Matrícula accesible: verifica primero el estudiante dueño de la matrícula. */
export async function exigirAccesoMatricula(
  actor: Actor,
  matriculaId: string,
  opciones: Parameters<typeof exigirAccesoEstudiante>[2],
) {
  const m = await repo.matriculaDeEstudiante(matriculaId);
  if (!m) throw new NotFoundError('La matrícula no existe');
  await exigirAccesoEstudiante(actor, m.estudiante_id, opciones);
  return m;
}

export async function cursosDelDocente(actor: Pick<Actor, 'personaId'>, fecha?: string) {
  const { docenteId } = await docenteDelActor(actor);
  return repo.cursosDeDocente(docenteId, fecha);
}

export async function exigirCursoDelDocente(actor: Pick<Actor, 'personaId'>, cursoId: string) {
  const { docenteId } = await docenteDelActor(actor);
  if (!(await repo.docenteTieneCurso(docenteId, cursoId))) throw new ForbiddenError('El curso no está asignado a usted');
  return { docenteId };
}

export async function exigirSeccionDelDocente(actor: Pick<Actor, 'personaId'>, seccionId: string) {
  const { docenteId } = await docenteDelActor(actor);
  if (!(await repo.docenteTieneSeccion(docenteId, seccionId))) throw new ForbiddenError('La sección no está asignada a usted');
  return { docenteId };
}
