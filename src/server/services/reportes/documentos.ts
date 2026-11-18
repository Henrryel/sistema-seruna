import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, ForbiddenError, NotFoundError } from '@/server/errores';
import { leerArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/reportes/documentos';
import * as repoPlantillas from '@/server/repositories/reportes/plantillas';
import type { Actor } from '@/server/auth/actor';
import type { DatosSolicitudDocumento } from '@/esquemas/reportes/documentos';

// Solicitud, consulta, descarga y anulación de documentos. El PERMISO del tipo, los filtros admitidos y la
// idempotencia por UUID los valida `preparar_documento_reporte`; las transiciones y la auditoría, los triggers.

/** Tipos de reporte cuyo permiso (tipos_reporte.permiso) tiene el actor. */
export async function tiposPermitidos(actor: Pick<Actor, 'permisos'>): Promise<string[]> {
  const tipos = await repoPlantillas.tiposReporte();
  return tipos.filter((t) => (actor.permisos as string[]).includes(t.permiso)).map((t) => t.codigo);
}

export async function plantillasDisponibles(actor: Actor) {
  return repoPlantillas.plantillasPublicadas(await tiposPermitidos(actor));
}

export async function solicitarDocumento(actor: Actor, d: DatosSolicitudDocumento) {
  return transaccion(() =>
    repo.prepararDocumento({
      uuid: d.solicitudUuid,
      plantillaId: d.plantillaId,
      actorId: actor.usuarioId,
      desde: d.desde,
      hasta: d.hasta,
      matriculaId: d.matriculaId,
      seccionId: d.seccionId,
      bimestreId: d.bimestreId,
    }),
  );
}

async function filtrosVisibilidad(actor: Actor, extra: Omit<repo.FiltrosDocumentos, 'usuarioId' | 'tiposPermitidos'> = {}) {
  return { usuarioId: actor.usuarioId, tiposPermitidos: await tiposPermitidos(actor), ...extra };
}

export async function listarDocumentos(
  actor: Actor,
  filtros: { q?: string; estado?: string; tipo?: string; anioId?: string; propios?: boolean },
  p: Parameters<typeof repo.listarDocumentos>[1],
) {
  return repo.listarDocumentos(
    await filtrosVisibilidad(actor, { q: filtros.q, estado: filtros.estado, tipo: filtros.tipo, anioId: filtros.anioId, soloPropios: filtros.propios }),
    p,
  );
}

export async function resumenCola(actor: Actor) {
  return repo.resumenCola(await filtrosVisibilidad(actor));
}

/** El solicitante o quien tenga el permiso del tipo puede descargar o anular. */
async function documentoGestionable(actor: Actor, id: string) {
  const doc = await repo.obtenerDocumento(id);
  if (!doc) throw new NotFoundError('El documento no existe');
  if (doc.solicitado_por !== actor.usuarioId && !(actor.permisos as string[]).includes(doc.permiso)) {
    throw new ForbiddenError('No tiene permiso sobre este documento');
  }
  return doc;
}

export async function descargarDocumento(actor: Actor, id: string) {
  return transaccion(async () => {
    const doc = await documentoGestionable(actor, id);
    if (doc.estado === 'anulado') throw new ConflictError('El documento fue anulado y ya no puede descargarse');
    if (!doc.archivo_id) {
      throw new ConflictError(doc.estado === 'preparado' ? 'El documento aún se está generando' : 'La generación del documento falló; solicítelo nuevamente');
    }
    const archivo = await leerArchivo(doc.archivo_id);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'descargar', entidad: 'documentos_emitidos', registroId: id, resultado: 'ok' });
    return archivo;
  });
}

/** emitido → anulado con motivo (el trigger rechaza otras transiciones y audita el cambio). */
export async function anularDocumento(actor: Actor, id: string, motivo: string) {
  return transaccion(async () => {
    await documentoGestionable(actor, id);
    const r = await repo.anularDocumento(id, actor.usuarioId, motivo);
    if (!r) throw new NotFoundError('El documento no existe');
    return r;
  });
}

export async function buscarMatriculas(anioId: string, q?: string) {
  const filas = await repo.buscarMatriculas(anioId, q);
  return filas.map((m) => ({
    valor: m.id,
    etiqueta: `${m.apellidos}, ${m.nombres} · ${m.codigo} · ${m.grado}.º${m.seccion ? ` ${m.seccion}` : ''} ${m.nivel}${m.estado === 'activa' ? '' : ` (${m.estado})`}`,
  }));
}
