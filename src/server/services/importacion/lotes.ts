import 'server-only';
import { createHash } from 'node:crypto';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/importacion/lotes';
import type { Actor } from '@/server/auth/actor';
import { ErrorParseo, parsearArchivoImportacion } from '@/esquemas/importacion/parseo';
import type { DatosConciliacion, DatosLote, DescriptorArchivoLote, DetalleLote } from '@/esquemas/importacion/lotes';

// Importación histórica: carga → revisión → cerrado. Las reglas viven en la base (avanzar_lote_historico,
// conciliar_fila_historica, controlar_carga_historica, CHECK de entidades y estados); el permiso
// datos.conciliar_historico también lo verifica la base al avanzar y conciliar.

export interface ArchivoImportacion {
  contenido: Buffer;
  nombreOriginal: string;
}

/** Texto del archivo: UTF-8 (con o sin BOM) y, si no es válido, Windows-1252 (exportaciones de Excel). */
export function decodificar(contenido: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(contenido);
  } catch {
    return new TextDecoder('windows-1252').decode(contenido);
  }
}

/** SHA-256 del contenido del lote: archivos ordenados por entidad y nombre, con su entidad y columna clave. */
export function hashLote(archivos: { entidad: string; columnaClave: string; nombre: string; contenido: Buffer }[]): Buffer {
  const h = createHash('sha256');
  for (const a of [...archivos].sort((x, y) => x.entidad.localeCompare(y.entidad) || x.nombre.localeCompare(y.nombre))) {
    h.update(`${a.entidad}\u0000${a.columnaClave}\u0000`);
    h.update(a.contenido);
    h.update('\u0000');
  }
  return h.digest();
}

function prepararFilas(descriptores: DescriptorArchivoLote[], archivos: ArchivoImportacion[]) {
  if (archivos.length === 0) throw new ValidationError('Adjunte al menos un archivo');
  if (archivos.length !== descriptores.length) throw new ValidationError('Indique la entidad y la columna clave de cada archivo');
  const filas: { entidad: string; claveOrigen: string; datos: Record<string, unknown> }[] = [];
  archivos.forEach((a, i) => {
    const d = descriptores[i] as DescriptorArchivoLote;
    try {
      for (const f of parsearArchivoImportacion(decodificar(a.contenido), a.nombreOriginal, d.columnaClave)) {
        filas.push({ entidad: d.entidad, claveOrigen: f.claveOrigen, datos: f.datos });
      }
    } catch (e) {
      if (e instanceof ErrorParseo) throw new ValidationError(`${a.nombreOriginal}: ${e.message}`);
      throw e;
    }
  });
  if (filas.length === 0) throw new ValidationError('Los archivos no contienen filas');
  return filas;
}

export const listarLotes = repo.listarLotes;
export const listarFilas = repo.listarFilas;
export const listarArchivoHistorico = repo.listarArchivoHistorico;
export const sistemasImportados = repo.sistemasImportados;

export async function detalleLote(id: string): Promise<DetalleLote> {
  const lote = await repo.obtenerLote(id);
  if (!lote) throw new NotFoundError('El lote no existe');
  return { ...lote, resumen: await repo.resumenLote(id) };
}

/** Crea el lote (estado 'carga') y carga sus filas en la misma transacción. */
export async function crearLote(actor: Actor, datos: DatosLote, archivos: ArchivoImportacion[]) {
  const filas = prepararFilas(datos.archivos, archivos);
  const sha256 = hashLote(
    archivos.map((a, i) => ({
      entidad: datos.archivos[i]?.entidad ?? '',
      columnaClave: datos.archivos[i]?.columnaClave ?? '',
      nombre: a.nombreOriginal,
      contenido: a.contenido,
    })),
  );
  return transaccion(async () => {
    const lote = await repo.crearLote({ sistema: datos.sistema, sha256, conteos: datos.conteos, creadoPor: actor.usuarioId });
    const n = await repo.insertarFilas(lote.id, filas);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'lotes_importacion', registroId: lote.id, motivo: `${n} fila(s) cargadas`, resultado: 'carga' });
    return { id: lote.id, estado: lote.estado, filas: n, sha256: sha256.toString('hex') };
  });
}

/** Carga archivos adicionales mientras el lote está en 'carga' (la base lo exige). */
export async function cargarArchivos(actor: Actor, loteId: string, descriptores: DescriptorArchivoLote[], archivos: ArchivoImportacion[]) {
  const filas = prepararFilas(descriptores, archivos);
  return transaccion(async () => {
    const n = await repo.insertarFilas(loteId, filas);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'cargar', entidad: 'lotes_importacion', registroId: loteId, motivo: `${n} fila(s) cargadas`, resultado: 'ok' });
    return { filas: n };
  });
}

export async function avanzarLote(actor: Actor, loteId: string) {
  return transaccion(async () => ({ estado: await repo.avanzarLote(loteId, actor.usuarioId) }));
}

export async function conciliarFila(actor: Actor, loteId: string, d: DatosConciliacion) {
  return transaccion(() =>
    repo.conciliarFila({
      loteId,
      entidad: d.entidad,
      claveOrigen: d.claveOrigen,
      actorId: actor.usuarioId,
      accion: d.accion,
      motivo: d.motivo,
      destinoId: d.destinoId,
      codigo: d.codigo,
      personaExistenteId: d.personaExistenteId,
    }),
  );
}

/** Archiva o excluye todas las filas pendientes de una entidad (una llamada a la base por fila, en una transacción). */
export async function conciliarPendientes(actor: Actor, loteId: string, d: { entidad: string; accion: 'archivar' | 'excluir'; motivo: string }) {
  return transaccion(async () => {
    const claves = await repo.clavesPendientes(loteId, d.entidad);
    for (const clave of claves) {
      await repo.conciliarFila({ loteId, entidad: d.entidad, claveOrigen: clave, actorId: actor.usuarioId, accion: d.accion, motivo: d.motivo });
    }
    return { conciliadas: claves.length };
  });
}
