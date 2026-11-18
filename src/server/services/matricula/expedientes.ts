import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError } from '@/server/errores';
import { guardarArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/matricula/expedientes';
import * as repoMatriculas from '@/server/repositories/matricula/matriculas';
import * as repoEstudiantes from '@/server/repositories/matricula/estudiantes';
import type { Actor } from '@/server/auth/actor';
import type { Checklist, DatosCargaExpediente, DatosRevision, EstadoRequisito } from '@/esquemas/matricula/expedientes';
import { conMensajes, hoy, type ArchivoSubido } from './comun';

// Expediente del estudiante: documentos con revisión (pendiente → validado/observado; reemplazado).
// La base exige revisor y fecha para validado/observado y la coherencia matrícula–estudiante (FK).

export const listarDocumentos = repo.listarDocumentos;

async function obtenerDocumento(id: string) {
  const d = await repo.obtenerDocumento(id);
  if (!d) throw new NotFoundError('El documento del expediente no existe');
  return d;
}

export async function cargarDocumento(actor: Actor, datos: DatosCargaExpediente, archivo: ArchivoSubido) {
  if (!(await repoEstudiantes.obtenerEstudiante(datos.estudianteId))) throw new NotFoundError('El estudiante no existe');
  return conMensajes(() =>
    transaccion(async () => {
      const a = await guardarArchivo(archivo);
      const r = await repo.crearDocumento({
        estudianteId: datos.estudianteId,
        matriculaId: datos.matriculaId ?? null,
        tipoDocumentoId: datos.tipoDocumentoId,
        archivoId: a.id,
        cargadoPor: actor.usuarioId,
      });
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'cargar', entidad: 'documentos_expediente', registroId: r.id, resultado: 'ok' });
      return { id: r.id, archivoId: a.id };
    }),
  );
}

export async function revisarDocumento(actor: Actor, id: string, datos: DatosRevision) {
  const d = await obtenerDocumento(id);
  if (d.estado === 'reemplazado') throw new ConflictError('El documento fue reemplazado: revise la versión vigente');
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.revisarDocumento(id, { estado: datos.estado, observacion: datos.observacion, revisadoPor: actor.usuarioId });
      await registrarBitacora({
        actorId: actor.usuarioId,
        accion: datos.estado === 'validado' ? 'validar' : 'observar',
        entidad: 'documentos_expediente',
        registroId: id,
        motivo: datos.observacion,
        resultado: 'ok',
      });
      return r;
    }),
  );
}

/** Reemplaza el archivo: el documento actual queda "reemplazado" y se carga uno nuevo pendiente de revisión. */
export async function reemplazarDocumento(actor: Actor, id: string, archivo: ArchivoSubido) {
  const d = await obtenerDocumento(id);
  if (d.estado === 'reemplazado') throw new ConflictError('El documento ya fue reemplazado');
  return conMensajes(() =>
    transaccion(async () => {
      const a = await guardarArchivo(archivo);
      await repo.marcarReemplazado(id);
      const r = await repo.crearDocumento({
        estudianteId: d.estudiante_id,
        matriculaId: d.matricula_id,
        tipoDocumentoId: d.tipo_documento_id,
        archivoId: a.id,
        cargadoPor: actor.usuarioId,
      });
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'reemplazar', entidad: 'documentos_expediente', registroId: r.id, motivo: `reemplaza ${id}`, resultado: 'ok' });
      return { id: r.id, archivoId: a.id };
    }),
  );
}

/** Requisitos de la regla de la matrícula frente a los documentos presentados. */
export async function checklistMatricula(matriculaId: string): Promise<Checklist> {
  const m = await repoMatriculas.obtenerMatricula(matriculaId);
  if (!m) throw new NotFoundError('La matrícula no existe');
  const filas = await repo.requisitosConDocumentos(matriculaId);
  const dia = hoy();
  const items = filas.map((f) => {
    let estado: EstadoRequisito;
    if (f.estado_documento === 'validado') estado = 'validado';
    else if (f.estado_documento === 'pendiente') estado = 'pendiente';
    else if (f.estado_documento === 'observado') estado = 'observado';
    else if (f.admite_regularizacion && (!f.plazo_regularizacion || f.plazo_regularizacion >= dia)) estado = 'en_regularizacion';
    else estado = 'faltante';
    return {
      tipo_documento_id: f.tipo_documento_id,
      codigo: f.codigo,
      nombre: f.nombre,
      obligatorio: f.obligatorio,
      admite_regularizacion: f.admite_regularizacion,
      plazo_regularizacion: f.plazo_regularizacion,
      documento_id: f.documento_id ?? null,
      estado_documento: f.estado_documento ?? null,
      observacion: f.observacion ?? null,
      estado,
    };
  });
  const obligatorios = items.filter((i) => i.obligatorio);
  const validados = obligatorios.filter((i) => i.estado === 'validado').length;
  return {
    matricula_id: matriculaId,
    regla_id: m.regla_id,
    items,
    obligatorios: obligatorios.length,
    obligatoriosValidados: validados,
    completo: validados === obligatorios.length,
  };
}
