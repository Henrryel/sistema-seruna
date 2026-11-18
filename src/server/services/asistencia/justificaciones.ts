import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errores';
import { exigirPermiso, tienePermiso } from '@/server/autorizacion/permisos';
import { docenteDelActor, exigirAccesoEstudiante } from '@/server/autorizacion/alcance';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/asistencia/justificaciones';
import type { Actor } from '@/server/auth/actor';
import {
  MAX_BYTES_EVIDENCIA,
  MIME_EVIDENCIA,
  type DatosResolverJustificacion,
  type DatosSolicitudJustificacion,
} from '@/esquemas/asistencia/justificaciones';

// Servicio: solicitudes de justificación y su resolución.
// - Alumno: solo su asistencia. Apoderado: hijo con vínculo vigente y acceso académico. Docente: su asistencia.
// - La base valida: nace "pendiente", solo justifica "ausente"/"tarde", se resuelve una sola vez sin
//   cambiar su contenido; al aprobarse, el trigger `aplicar_justificacion` pasa la asistencia a
//   "justificado" y registra el evento en bitácora (por eso no se duplica registrarBitacora aquí).

export const listarJustificaciones = repo.listarJustificaciones;

export interface Evidencia {
  contenido: Buffer;
  nombreOriginal: string;
  tipoMime: string;
}

function validarEvidencia(e: Evidencia | null | undefined) {
  if (!e) return;
  if (!(MIME_EVIDENCIA as readonly string[]).includes(e.tipoMime)) throw new ValidationError('La evidencia debe ser PDF o imagen (PNG, JPG o WebP)');
  if (e.contenido.length > MAX_BYTES_EVIDENCIA) throw new ValidationError('La evidencia supera el tamaño máximo (5 MB)');
}

async function registrar(actor: Actor, destino: { estudiante?: string; docente?: string }, d: DatosSolicitudJustificacion, evidencia?: Evidencia | null) {
  validarEvidencia(evidencia);
  return transaccion(async () => {
    const archivo = evidencia ? await guardarArchivo(evidencia) : null;
    return repo.insertarJustificacion({
      asistenciaEstudianteId: destino.estudiante ?? null,
      asistenciaDocenteId: destino.docente ?? null,
      solicitadaPor: actor.usuarioId,
      motivo: d.motivo,
      evidenciaId: archivo?.id ?? null,
    });
  });
}

/** Justificación de una asistencia de alumno, desde el portal del alumno o del apoderado. */
export async function solicitarParaAlumno(actor: Actor, d: DatosSolicitudJustificacion, portal: 'estudiante' | 'padre', evidencia?: Evidencia | null) {
  exigirPermiso(actor, 'asistencia.justificar');
  const a = await repo.asistenciaAlumnoConEstudiante(d.asistenciaId);
  if (!a) throw new NotFoundError('El registro de asistencia no existe');
  await exigirAccesoEstudiante(actor, a.estudiante_id, { portal, tipo: 'academico' });
  return registrar(actor, { estudiante: a.id }, d, evidencia);
}

/** Justificación de la asistencia propia del docente. */
export async function solicitarParaDocente(actor: Actor, d: DatosSolicitudJustificacion, evidencia?: Evidencia | null) {
  exigirPermiso(actor, 'asistencia.justificar');
  const a = await repo.asistenciaDocenteConDocente(d.asistenciaId);
  if (!a) throw new NotFoundError('El registro de asistencia no existe');
  const { docenteId } = await docenteDelActor(actor);
  if (a.docente_id !== docenteId) throw new ForbiddenError('Solo puede justificar su propia asistencia');
  return registrar(actor, { docente: a.id }, d, evidencia);
}

/** Aprueba o rechaza (una sola vez). Al aprobar, la base marca la asistencia como "justificado". */
export async function resolver(actor: Actor, id: string, d: DatosResolverJustificacion) {
  exigirPermiso(actor, 'asistencia.resolver');
  return transaccion(async () => {
    const r = await repo.resolverJustificacion(id, { estado: d.estado, decision: d.decision, resueltaPor: actor.usuarioId });
    if (!r) {
      const j = await repo.obtenerJustificacion(id);
      if (!j) throw new NotFoundError('La justificación no existe');
      throw new ConflictError('La justificación ya fue resuelta');
    }
    return r;
  });
}

/** Evidencia: quien resuelve, quien la solicitó, o el alumno/apoderado/docente con acceso a esa asistencia. */
export async function evidencia(actor: Actor, id: string) {
  const j = await repo.obtenerJustificacion(id);
  if (!j) throw new NotFoundError('La justificación no existe');
  if (!j.evidencia_id) throw new NotFoundError('La justificación no tiene evidencia adjunta');
  if (!tienePermiso(actor, 'asistencia.resolver') && j.solicitada_por !== actor.usuarioId) {
    if (j.estudiante_id) {
      const estudianteId = j.estudiante_id;
      const propio = actor.portales.includes('estudiante')
        ? await exigirAccesoEstudiante(actor, estudianteId, { portal: 'estudiante', tipo: 'academico' }).then(
            () => true,
            () => false,
          )
        : false;
      if (!propio) await exigirAccesoEstudiante(actor, estudianteId, { portal: 'padre', tipo: 'academico' });
    } else {
      const { docenteId } = await docenteDelActor(actor);
      if (j.docente_id !== docenteId) throw new ForbiddenError();
    }
  }
  const archivo = await leerArchivo(j.evidencia_id);
  // La evidencia puede contener datos de salud (sensibles): se audita cada acceso de terceros.
  if (j.solicitada_por !== actor.usuarioId) {
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'descargar', entidad: 'justificaciones_asistencia', registroId: id, motivo: 'Evidencia', resultado: 'ok' });
  }
  return archivo;
}
