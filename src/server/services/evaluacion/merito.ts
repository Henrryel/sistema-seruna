import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as ctx from '@/server/repositories/evaluacion/contexto';
import * as repo from '@/server/repositories/evaluacion/merito';
import type { Actor } from '@/server/auth/actor';
import type { DatosPublicacion, DetallePublicacion } from '@/esquemas/evaluacion/merito';

// Orden de mérito oficial: se concilia el listado de SIAGIE (no se calcula). La base valida Secundaria, regla
// aprobada, alcance, puestos consecutivos y cierres lectivos aprobados; publicado = inmutable (versionar).

export const listarPublicaciones = repo.listarPublicaciones;
export const meritoPublicado = repo.meritoPublicado;

async function exigirPublicacion(id: string) {
  const p = await repo.obtenerPublicacion(id);
  if (!p) throw new NotFoundError('La publicación de mérito no existe');
  return p;
}

export async function detallePublicacion(id: string): Promise<DetallePublicacion> {
  const p = await exigirPublicacion(id);
  const [puestosDetalle, candidatos] = await Promise.all([repo.puestosDe(id), repo.candidatos(id, p.anio_id, p.grado_id)]);
  return { ...p, puestosDetalle, candidatos };
}

export async function registrarPublicacion(actor: Actor, d: DatosPublicacion, archivo: { contenido: Buffer; nombreOriginal: string; tipoMime: string }) {
  const regla = await ctx.reglaAprobadaVigente(d.anioId, d.gradoId);
  if (!regla) throw new ValidationError('El mérito requiere Secundaria y una regla aprobada; el alcance completo usa quinto grado');
  return transaccion(async () => {
    const a = await guardarArchivo(archivo);
    const r = await repo.crearPublicacion({ ...d, reglaId: regla.id, archivoId: a.id, registradoPor: actor.usuarioId });
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'publicaciones_merito', registroId: r.id, motivo: d.referenciaSiagie, resultado: 'ok' });
    return r;
  });
}

/** Registra o reemplaza puestos (se quitan primero los de esas matrículas para permitir reordenar). */
export async function registrarPuestos(
  actor: Actor,
  id: string,
  puestos: { matriculaId: string; puesto: number; calificativo: string; sustentoDesempate: string | null }[],
) {
  await exigirPublicacion(id);
  return transaccion(async () => {
    for (const p of puestos) await repo.quitarPuesto(id, p.matriculaId);
    for (const p of puestos) {
      const cierre = await repo.cierreLectivo(p.matriculaId);
      if (!cierre) throw new ValidationError('El puesto debe apuntar a un cierre lectivo aprobado del mismo año y grado');
      await repo.insertarPuesto({ publicacionId: id, matriculaId: p.matriculaId, cierreAnualId: cierre.id, puesto: p.puesto, calificativo: p.calificativo, sustentoDesempate: p.sustentoDesempate });
    }
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'registrar_puestos', entidad: 'publicaciones_merito', registroId: id, motivo: `${puestos.length} puesto(s)`, resultado: 'ok' });
    return { registrados: puestos.length };
  });
}

export async function quitarPuesto(actor: Actor, id: string, matriculaId: string) {
  return transaccion(async () => {
    const r = await repo.quitarPuesto(id, matriculaId);
    if (!r) throw new NotFoundError('El puesto no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'quitar_puesto', entidad: 'publicaciones_merito', registroId: id, motivo: `matrícula ${matriculaId}`, resultado: 'ok' });
    return { ok: true };
  });
}

/** Publicar: la base exige puestos consecutivos y audita la publicación (auditar_merito). */
export async function publicar(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.publicar(id, actor.usuarioId);
    if (!r) throw new NotFoundError('La publicación de mérito no existe');
    return r;
  });
}

export async function eliminarPublicacion(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.eliminarPublicacion(id);
    if (!r) throw new NotFoundError('La publicación de mérito no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'publicaciones_merito', registroId: id, resultado: 'ok' });
    return r;
  });
}

export async function archivoPublicacion(id: string) {
  const p = await exigirPublicacion(id);
  return leerArchivo(p.archivo_siagie_id);
}
