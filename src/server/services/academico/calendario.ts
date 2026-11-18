import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import { obtenerAnio } from '@/server/repositories/academico/anios';
import * as repo from '@/server/repositories/academico/calendario';
import { formatoFecha } from '@/lib/formato';
import type { Actor } from '@/server/auth/actor';
import type { DatosDiaCalendario, DatosGenerarLectivos } from '@/esquemas/academico/calendario';
import { conMensajes } from './restricciones';

// Calendario escolar: días lectivos, feriados y no lectivos por año (PK año + fecha).

export const listarDias = repo.listarDias;

async function exigirAnio(anioId: string) {
  const anio = await obtenerAnio(anioId);
  if (!anio) throw new NotFoundError('El año académico no existe');
  return anio;
}

function exigirDentroDelAnio(anio: { inicio: string; fin: string; anio: number }, ...fechas: string[]) {
  for (const f of fechas) {
    if (f < anio.inicio || f > anio.fin) {
      throw new ValidationError(`La fecha debe estar dentro del año escolar ${anio.anio} (${formatoFecha(anio.inicio)} – ${formatoFecha(anio.fin)})`);
    }
  }
}

export async function resumen(anioId: string) {
  await exigirAnio(anioId);
  return repo.resumen(anioId);
}

const clave = (anioId: string, fecha: string) => `${anioId}:${fecha}`;

export async function crearDia(actor: Actor, d: DatosDiaCalendario) {
  exigirDentroDelAnio(await exigirAnio(d.anioId), d.fecha);
  return transaccion(async () => {
    const r = await conMensajes(() => repo.crearDia(d));
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'calendario_escolar', registroId: clave(d.anioId, d.fecha), motivo: d.tipo, resultado: 'ok' });
    return r;
  });
}

export async function actualizarDia(actor: Actor, anioId: string, fecha: string, d: { tipo: string; descripcion: string | null }) {
  return transaccion(async () => {
    const r = await repo.actualizarDia(anioId, fecha, d);
    if (!r) throw new NotFoundError('El día no está registrado en el calendario');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'calendario_escolar', registroId: clave(anioId, fecha), motivo: d.tipo, resultado: 'ok' });
    return r;
  });
}

export async function eliminarDia(actor: Actor, anioId: string, fecha: string) {
  return transaccion(async () => {
    const r = await repo.eliminarDia(anioId, fecha);
    if (!r) throw new NotFoundError('El día no está registrado en el calendario');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'calendario_escolar', registroId: clave(anioId, fecha), resultado: 'ok' });
    return r;
  });
}

/** Registra como lectivos los lunes a viernes del rango, sin modificar los días ya registrados. */
export async function generarLectivos(actor: Actor, d: DatosGenerarLectivos) {
  exigirDentroDelAnio(await exigirAnio(d.anioId), d.desde, d.hasta);
  return transaccion(async () => {
    const creados = await repo.generarLectivos(d.anioId, d.desde, d.hasta, d.descripcion);
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'generar_lectivos',
      entidad: 'calendario_escolar',
      registroId: d.anioId,
      motivo: `${creados} día(s) del ${d.desde} al ${d.hasta}`,
      resultado: 'ok',
    });
    return { creados };
  });
}
