import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/matricula/estudiantes';
import * as repoPersonas from '@/server/repositories/matricula/personas';
import * as repoApoderados from '@/server/repositories/matricula/apoderados';
import * as repoMatriculas from '@/server/repositories/matricula/matriculas';
import type { Actor } from '@/server/auth/actor';
import type { DatosDocumentoIdentidad } from '@/esquemas/matricula/comunes';
import type { DatosEstudianteEdicion, DatosEstudianteNuevo, FichaEstudiante } from '@/esquemas/matricula/estudiantes';
import { conMensajes, resolverPersona } from './comun';

export const listarEstudiantes = repo.listarEstudiantes;
export const buscarPersonas = repoPersonas.buscarPersonas;

export async function obtenerEstudiante(id: string) {
  const e = await repo.obtenerEstudiante(id);
  if (!e) throw new NotFoundError('El estudiante no existe');
  return e;
}

/** Ficha completa: datos, documentos, cuenta de acceso, apoderados, matrículas y responsables económicos. */
export async function fichaEstudiante(id: string): Promise<FichaEstudiante> {
  const estudiante = await obtenerEstudiante(id);
  const [documentos, usuario, apoderados, matriculas, responsables] = await Promise.all([
    repoPersonas.documentosDePersona(estudiante.persona_id),
    repoPersonas.usuarioDePersona(estudiante.persona_id),
    repoApoderados.listarApoderados(id),
    repoMatriculas.listarMatriculas({ estudianteId: id }, null),
    repoMatriculas.listarResponsables({ estudianteId: id }),
  ]);
  return { estudiante, documentos, usuario, apoderados, matriculas: matriculas.filas, responsables };
}

export async function crearEstudiante(actor: Actor, datos: DatosEstudianteNuevo) {
  return conMensajes(() =>
    transaccion(async () => {
      const { personaId, creada } = await resolverPersona(datos);
      if (creada) await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'personas', registroId: personaId, resultado: 'ok' });
      const r = await repo.crearEstudiante({ personaId, codigo: datos.codigo, codigoSiagie: datos.codigoSiagie, activo: datos.activo });
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'estudiantes', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}

export async function actualizarEstudiante(actor: Actor, id: string, datos: DatosEstudianteEdicion) {
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.actualizarEstudiante(id, datos);
      if (!r) throw new NotFoundError('El estudiante no existe');
      await repoPersonas.actualizarPersona(r.persona_id, datos);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'estudiantes', registroId: id, resultado: 'ok' });
      return r;
    }),
  );
}

/** Agrega un documento de identidad a la persona del estudiante o de uno de sus apoderados (`vinculoId`). */
export async function agregarDocumentoIdentidad(actor: Actor, ref: { estudianteId: string } | { vinculoId: string }, datos: DatosDocumentoIdentidad) {
  let personaId: string;
  if ('estudianteId' in ref) {
    personaId = (await obtenerEstudiante(ref.estudianteId)).persona_id;
  } else {
    const v = await repoApoderados.obtenerVinculo(ref.vinculoId);
    if (!v) throw new NotFoundError('El vínculo no existe');
    personaId = v.persona_id;
  }
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repoPersonas.crearDocumentoIdentidad(personaId, datos);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'documentos_identidad', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}
