import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/planilla/horas';
import type { Actor } from '@/server/auth/actor';
import type { DatosHora, DatosResolverHora } from '@/esquemas/planilla/horas';
import { guardarAdjunto, type ArchivoSubido } from './archivos';

// Servicio de horas docentes. `validar_horas_docente` exige contrato por horas vigente, horas ya trabajadas
// (hora Lima), sesión realizada del mismo docente, período abierto para aprobar y que no haya liquidación
// aprobada; la base además impide solapes y audita la resolución. No se replica nada de eso aquí.

export const listarHoras = repo.listarHoras;
export const sesionesRealizadas = repo.sesionesRealizadas;

export async function registrarHora(actor: Actor, d: DatosHora, evidencia?: ArchivoSubido | null) {
  return transaccion(async () => {
    const evidenciaId = await guardarAdjunto(evidencia);
    const r = await repo.crearHora({ ...d, evidenciaId, registradoPor: actor.usuarioId });
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'registrar',
      entidad: 'horas_docentes',
      registroId: r.id,
      motivo: d.motivo,
      resultado: 'pendiente',
    });
    return { id: r.id, minutos: Number(r.minutos ?? 0) };
  });
}

/** Aprueba o rechaza una hora pendiente con su decisión (la auditoría la hace el trigger `auditar_planilla`). */
export async function resolverHora(actor: Actor, id: string, d: DatosResolverHora) {
  return transaccion(async () => {
    const r = await repo.resolverHora(id, { ...d, resueltoPor: actor.usuarioId });
    if (!r) throw new NotFoundError('El registro de horas no existe');
    return r;
  });
}
