import 'server-only';
import { db } from '@/server/db';

export interface EntradaBitacora {
  actorId?: string | null;
  usuarioAfectadoId?: string | null;
  accion: string;
  entidad: string;
  registroId?: string | number | null;
  motivo?: string | null;
  resultado: string;
}

/** Inserta un evento de auditoría. Debe llamarse dentro de la misma transacción de la operación auditada. */
export async function registrarBitacora(e: EntradaBitacora): Promise<void> {
  await db()
    .insertInto('bitacora')
    .values({
      actor_id: e.actorId ?? null,
      usuario_afectado_id: e.usuarioAfectadoId ?? null,
      accion: e.accion,
      entidad: e.entidad,
      registro_id: e.registroId == null ? null : String(e.registroId),
      motivo: e.motivo ?? null,
      resultado: e.resultado,
    })
    .execute();
}

export async function contarEventos(filtro: {
  usuarioAfectadoId: string;
  accion: string;
  resultado: string;
  desde: Date;
}): Promise<number> {
  const fila = await db()
    .selectFrom('bitacora')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('usuario_afectado_id', '=', filtro.usuarioAfectadoId)
    .where('accion', '=', filtro.accion)
    .where('resultado', '=', filtro.resultado)
    .where('ocurrido_en', '>=', filtro.desde)
    .executeTakeFirstOrThrow();
  return Number(fila.n);
}
