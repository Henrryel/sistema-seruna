import 'server-only';
import { transaccion } from '@/server/db';
import { aErrorDominio, ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as ctx from '@/server/repositories/evaluacion/contexto';
import * as repo from '@/server/repositories/evaluacion/cierres';
import type { Actor } from '@/server/auth/actor';
import type { AccionCierre, AccionLote, DetalleCierre, ResultadoLote } from '@/esquemas/evaluacion/cierres';

// Cierres de bimestre: abrir (borrador), cerrar, publicar y reabrir. Completitud de notas, conclusiones
// obligatorias y transiciones válidas las verifica `validar_cierre_evaluacion`; aquí no se duplican.

export const listarCierres = repo.listarCierres;

export async function detalleCierre(id: string): Promise<DetalleCierre> {
  const c = await repo.obtenerCierre(id);
  if (!c) throw new NotFoundError('El cierre no existe');
  const { faltantes, total } = await repo.faltantesCierre(id);
  return { ...c, faltantes, totalFaltantes: total };
}

export async function abrirRegistro(actor: Actor, datos: { bimestreId: string; seccionIds?: string[] }) {
  const b = await ctx.obtenerBimestre(datos.bimestreId);
  if (!b) throw new NotFoundError('El bimestre no existe');
  return transaccion(async () => {
    const creados = await repo.abrirCierres(b.id, actor.usuarioId, datos.seccionIds);
    for (const c of creados) {
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'abrir_registro', entidad: 'cierres_evaluacion', registroId: c.id, resultado: 'ok' });
    }
    if (datos.seccionIds?.length && !creados.length) {
      throw new ValidationError('Las secciones indicadas ya tienen el registro abierto o no pertenecen al año del bimestre');
    }
    return { creados: creados.length };
  });
}

const ESTADO_DESTINO: Record<AccionCierre, string> = { cerrar: 'cerrado', publicar: 'publicado', reabrir: 'borrador' };

export async function ejecutarAccion(actor: Actor, id: string, accion: AccionCierre, motivo?: string) {
  const actual = await repo.obtenerCierreSimple(id);
  if (!actual) throw new NotFoundError('El cierre no existe');
  if (actual.estado === ESTADO_DESTINO[accion]) throw new ConflictError(`El cierre ya está en estado ${actual.estado}`);
  return transaccion(async () => {
    const r = await repo.cambiarEstado(id, accion, actor.usuarioId);
    if (!r) throw new NotFoundError('El cierre no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion, entidad: 'cierres_evaluacion', registroId: id, motivo: motivo ?? null, resultado: 'ok' });
    return r;
  });
}

/** Acción masiva: cada cierre se procesa por separado y se informa el resultado de cada uno. */
export async function ejecutarLote(actor: Actor, datos: AccionLote): Promise<ResultadoLote[]> {
  const resultados: ResultadoLote[] = [];
  for (const id of datos.ids) {
    try {
      await ejecutarAccion(actor, id, datos.accion, datos.motivo);
      resultados.push({ id, ok: true, mensaje: 'Listo' });
    } catch (e) {
      resultados.push({ id, ok: false, mensaje: aErrorDominio(e).message });
    }
  }
  return resultados;
}
