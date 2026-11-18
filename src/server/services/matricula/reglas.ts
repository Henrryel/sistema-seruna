import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/matricula/reglas';
import type { Actor } from '@/server/auth/actor';
import type { DatosRegla, DatosRequisito, DatosTipoDocumento } from '@/esquemas/matricula/reglas';
import { conMensajes } from './comun';

// Reglas de matrícula versionadas: una versión publicada no se edita; se crea una versión nueva.
// La base valida ventana, edades, corte y unicidad de versión.

export const listarReglas = repo.listarReglas;
export const listarRequisitos = repo.listarRequisitos;
export const listarTiposDocumento = repo.listarTiposDocumento;

export async function obtenerRegla(id: string) {
  const r = await repo.obtenerRegla(id);
  if (!r) throw new NotFoundError('La regla de matrícula no existe');
  return r;
}

async function reglaEditable(id: string) {
  const r = await obtenerRegla(id);
  if (r.publicada_en) throw new ConflictError('La regla ya está publicada: cree una nueva versión para cambiarla');
  return r;
}

export async function crearRegla(actor: Actor, datos: DatosRegla) {
  return conMensajes(() =>
    transaccion(async () => {
      const version = await repo.siguienteVersion(datos.anioId, datos.gradoId, datos.tipoIngreso);
      const r = await repo.crearRegla(datos, version);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'reglas_matricula', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}

export async function actualizarRegla(actor: Actor, id: string, datos: DatosRegla) {
  const actual = await reglaEditable(id);
  return conMensajes(() =>
    transaccion(async () => {
      const cambiaClave = actual.anio_id !== datos.anioId || actual.grado_id !== datos.gradoId || actual.tipo_ingreso !== datos.tipoIngreso;
      if (cambiaClave) throw new ConflictError('El año, grado y tipo de ingreso de una regla no se cambian: cree otra regla');
      const r = await repo.actualizarRegla(id, datos);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'reglas_matricula', registroId: id, resultado: 'ok' });
      return r;
    }),
  );
}

export async function publicarRegla(actor: Actor, id: string) {
  await reglaEditable(id);
  return transaccion(async () => {
    const r = await repo.publicarRegla(id);
    if (!r) throw new ConflictError('La regla ya está publicada');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'publicar', entidad: 'reglas_matricula', registroId: id, resultado: 'ok' });
    return r;
  });
}

/** Nueva versión (borrador) copiando datos y requisitos de la regla indicada. */
export async function nuevaVersion(actor: Actor, id: string) {
  const origen = await obtenerRegla(id);
  return conMensajes(() =>
    transaccion(async () => {
      const datos: DatosRegla = {
        anioId: origen.anio_id,
        gradoId: origen.grado_id,
        tipoIngreso: origen.tipo_ingreso as DatosRegla['tipoIngreso'],
        solicitudesInicio: origen.solicitudes_inicio,
        solicitudesFin: origen.solicitudes_fin,
        corteEdad: origen.corte_edad ?? undefined,
        edadMinima: origen.edad_minima,
        edadMaxima: origen.edad_maxima,
        referenciaNormativa: origen.referencia_normativa,
      };
      const version = await repo.siguienteVersion(datos.anioId, datos.gradoId, datos.tipoIngreso);
      const r = await repo.crearRegla(datos, version);
      await repo.copiarRequisitos(id, r.id);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'nueva_version', entidad: 'reglas_matricula', registroId: r.id, motivo: `desde regla ${id}`, resultado: 'ok' });
      return r;
    }),
  );
}

export async function eliminarRegla(actor: Actor, id: string) {
  await reglaEditable(id);
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.eliminarRegla(id);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'reglas_matricula', registroId: id, resultado: 'ok' });
      return r;
    }),
  );
}

export async function guardarRequisito(actor: Actor, reglaId: string, datos: DatosRequisito) {
  await reglaEditable(reglaId);
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.guardarRequisito(reglaId, datos);
      await registrarBitacora({
        actorId: actor.usuarioId,
        accion: 'guardar_requisito',
        entidad: 'requisitos_matricula',
        registroId: `${reglaId}:${datos.tipoDocumentoId}`,
        resultado: 'ok',
      });
      return r;
    }),
  );
}

export async function eliminarRequisito(actor: Actor, reglaId: string, tipoDocumentoId: string) {
  await reglaEditable(reglaId);
  return transaccion(async () => {
    const r = await repo.eliminarRequisito(reglaId, tipoDocumentoId);
    if (!r) throw new NotFoundError('El requisito no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'requisitos_matricula', registroId: `${reglaId}:${tipoDocumentoId}`, resultado: 'ok' });
    return r;
  });
}

export async function crearTipoDocumento(actor: Actor, datos: DatosTipoDocumento) {
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.crearTipoDocumento(datos);
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'tipos_documento', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}

export async function actualizarTipoDocumento(actor: Actor, id: string, datos: DatosTipoDocumento) {
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.actualizarTipoDocumento(id, datos);
      if (!r) throw new NotFoundError('El tipo de documento no existe');
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'tipos_documento', registroId: id, resultado: 'ok' });
      return r;
    }),
  );
}

/** Solo si no está en uso (la base lo impide por FK). */
export async function eliminarTipoDocumento(actor: Actor, id: string) {
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.eliminarTipoDocumento(id);
      if (!r) throw new NotFoundError('El tipo de documento no existe');
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'tipos_documento', registroId: id, resultado: 'ok' });
      return r;
    }),
  );
}
