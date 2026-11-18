import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/reportes/plantillas';
import type { Actor } from '@/server/auth/actor';
import type { DatosPlantilla } from '@/esquemas/reportes/plantillas';
import type { ArchivoSubido } from './entrada';

// Plantillas de documento. Formato, versión única, configuración objeto e inmutabilidad al publicar los
// impone la base (CHECK + trigger proteger_plantilla_publicada). Aquí: transacción, archivo y auditoría.

export const listarPlantillas = repo.listarPlantillas;
export const tiposReporte = repo.tiposReporte;

export async function obtenerPlantilla(id: string) {
  const p = await repo.obtenerPlantilla(id);
  if (!p) throw new NotFoundError('La plantilla no existe');
  return p;
}

export async function crearPlantilla(actor: Actor, datos: DatosPlantilla, archivo?: ArchivoSubido | null) {
  return transaccion(async () => {
    const archivoId = archivo ? (await guardarArchivo(archivo)).id : null;
    const version = datos.version ?? (await repo.siguienteVersion(datos.tipo, datos.anioId, datos.formato));
    const r = await repo.crearPlantilla({
      tipo: datos.tipo,
      anioId: datos.anioId,
      formato: datos.formato,
      version,
      nombre: datos.nombre,
      archivoId,
      configuracion: datos.configuracion,
      creadaPor: actor.usuarioId,
    });
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'plantillas_documento', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

/** Edita un borrador (publicada → la base exige una versión nueva). */
export async function actualizarPlantilla(actor: Actor, id: string, datos: DatosPlantilla, archivo?: ArchivoSubido | null) {
  const actual = await obtenerPlantilla(id);
  return transaccion(async () => {
    const archivoId = archivo ? (await guardarArchivo(archivo)).id : undefined;
    const r = await repo.actualizarPlantilla(id, {
      tipo: datos.tipo,
      anioId: datos.anioId,
      formato: datos.formato,
      version: datos.version ?? actual.version,
      nombre: datos.nombre,
      configuracion: datos.configuracion,
      archivoId,
    });
    if (!r) throw new NotFoundError('La plantilla no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'plantillas_documento', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function publicarPlantilla(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.publicarPlantilla(id);
    if (!r) throw new NotFoundError('La plantilla no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'publicar', entidad: 'plantillas_documento', registroId: id, resultado: 'ok' });
    return r;
  });
}

/** Nueva versión (borrador) a partir de otra: mismo tipo, año, formato, nombre, configuración y archivo. */
export async function nuevaVersion(actor: Actor, id: string) {
  const base = await obtenerPlantilla(id);
  return transaccion(async () => {
    const version = await repo.siguienteVersion(base.tipo, base.anio_id, base.formato);
    const r = await repo.crearPlantilla({
      tipo: base.tipo,
      anioId: base.anio_id,
      formato: base.formato,
      version,
      nombre: base.nombre,
      archivoId: base.archivo_id,
      configuracion: base.configuracion,
      creadaPor: actor.usuarioId,
    });
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'versionar',
      entidad: 'plantillas_documento',
      registroId: r.id,
      motivo: `Nueva versión de la plantilla ${id}`,
      resultado: 'ok',
    });
    return r;
  });
}

export async function archivoPlantilla(id: string) {
  const p = await obtenerPlantilla(id);
  if (!p.archivo_id) throw new NotFoundError('La plantilla no tiene archivo adjunto');
  return leerArchivo(p.archivo_id);
}
