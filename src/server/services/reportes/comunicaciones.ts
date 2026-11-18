import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/reportes/comunicaciones';
import type { Actor } from '@/server/auth/actor';
import type { DatosComunicacion } from '@/esquemas/reportes/comunicaciones';
import type { ArchivoSubido } from './entrada';

// Comunicación de documentos institucionales. La base exige destinatario o alcance (CHECK) y la existencia
// del documento (FK); aquí: evidencia opcional, transacción y auditoría.

export const listarComunicaciones = repo.listarComunicaciones;
export const documentosInstitucionales = repo.documentosInstitucionales;

export async function buscarPersonas(q: string) {
  const filas = await repo.buscarPersonas(q);
  return filas.map((p) => ({ valor: p.id, etiqueta: `${p.apellidos}, ${p.nombres}${p.documento ? ` · ${p.documento}` : ''}` }));
}

export async function registrarComunicacion(actor: Actor, d: DatosComunicacion, evidencia?: ArchivoSubido | null) {
  return transaccion(async () => {
    const evidenciaId = evidencia ? (await guardarArchivo(evidencia)).id : null;
    const r = await repo.crearComunicacion({
      documentoId: d.documentoId,
      destinatarioId: d.destinatarioId ?? null,
      alcance: d.alcance,
      comunicadoEn: d.comunicadoEn,
      canal: d.canal,
      evidenciaId,
      registradoPor: actor.usuarioId,
    });
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'comunicar', entidad: 'comunicaciones_documento', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function evidenciaComunicacion(actor: Actor, id: string) {
  return transaccion(async () => {
    const c = await repo.obtenerComunicacion(id);
    if (!c) throw new NotFoundError('La comunicación no existe');
    if (!c.evidencia_id) throw new NotFoundError('La comunicación no tiene evidencia adjunta');
    const archivo = await leerArchivo(c.evidencia_id);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'descargar', entidad: 'comunicaciones_documento', registroId: id, resultado: 'ok' });
    return archivo;
  });
}
