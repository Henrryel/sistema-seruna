import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/asistencia/credenciales';
import { generarTokenCredencial } from '@/server/asistencia/tokens';
import { hashToken } from '@/server/auth/tokens';
import { imagenCode128, imagenQr } from '@/server/asistencia/codigos';
import { generarPdfCarnets, type Carnet } from '@/server/pdf/asistencia/carnets';
import { hoyLima } from '@/lib/formato';
import type { Actor } from '@/server/auth/actor';
import type { DatosEmitirCredenciales } from '@/esquemas/asistencia/credenciales';

// Servicio: emisión (y reemisión) de credenciales QR con impresión de carnets en el MISMO momento,
// porque el token solo existe al emitir: la base guarda únicamente hashToken(token).

export const listarCredenciales = repo.listarCredenciales;
export const buscarPersonas = repo.buscarPersonas;

export const MAX_CREDENCIALES_POR_EMISION = 300;

export interface CredencialEmitida {
  personaId: string;
  credencialId: string;
  /** Solo para quien imprime (y pruebas): nunca se persiste ni se devuelve por la API. */
  token: string;
}

async function personasAEmitir(d: DatosEmitirCredenciales): Promise<{ personaIds: string[]; detalle: string }> {
  if (d.modo === 'personas') return { personaIds: [...new Set(d.personaIds)], detalle: 'selección' };
  if (d.modo === 'seccion') {
    const seccion = await repo.etiquetaSeccion(d.seccionId as string);
    if (!seccion) throw new NotFoundError('La sección no existe');
    return { personaIds: await repo.personasDeSeccion(d.seccionId as string), detalle: `sección ${seccion.etiqueta}` };
  }
  return { personaIds: await repo.personasDeDocentes(d.docenteIds), detalle: d.docenteIds.length ? 'docentes elegidos' : 'todos los docentes activos' };
}

/**
 * Emite una credencial nueva por persona (revocando las anteriores aún utilizables) y genera el PDF de
 * carnets con QR y Code 128 del mismo token. Todo en una transacción: si el PDF falla, no se emite nada.
 */
export async function emitirCredenciales(actor: Actor, d: DatosEmitirCredenciales): Promise<{ pdf: Buffer; emitidas: CredencialEmitida[]; revocadas: number }> {
  if (d.expiraEn < hoyLima()) throw new ValidationError('La fecha de vencimiento debe ser hoy o posterior');
  const { personaIds, detalle } = await personasAEmitir(d);
  const carnets = await repo.datosCarnet(personaIds);
  if (carnets.length === 0) throw new ValidationError('No hay alumnos o docentes activos para emitir credenciales');
  if (carnets.length > MAX_CREDENCIALES_POR_EMISION) {
    throw new ValidationError(`Emita como máximo ${MAX_CREDENCIALES_POR_EMISION} credenciales por vez`);
  }
  return transaccion(async () => {
    const revocadas = await repo.revocarVigentesDe(
      carnets.map((c) => c.persona_id),
      actor.usuarioId,
    );
    const emitidas: CredencialEmitida[] = [];
    const paraImprimir: Carnet[] = [];
    for (const c of carnets) {
      const token = generarTokenCredencial();
      const r = await repo.insertarCredencial({ personaId: c.persona_id, tokenHash: hashToken(token), emitidaPor: actor.usuarioId, expiraEn: d.expiraEn });
      emitidas.push({ personaId: c.persona_id, credencialId: r.id, token });
      const [qr, code128] = await Promise.all([imagenQr(token), imagenCode128(token)]);
      paraImprimir.push({ nombres: c.nombres, apellidos: c.apellidos, perfil: c.perfil, codigo: c.codigo, detalle: c.detalle, expiraEn: d.expiraEn, qr, code128 });
    }
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'emitir',
      entidad: 'credenciales_qr',
      registroId: emitidas.length === 1 ? emitidas[0]?.credencialId : null,
      motivo: `${emitidas.length} credencial(es), ${detalle}, vence ${d.expiraEn}; ${revocadas} anterior(es) revocada(s)`,
      resultado: 'ok',
    });
    const pdf = await generarPdfCarnets(paraImprimir);
    return { pdf, emitidas, revocadas };
  });
}

export async function revocarCredencial(actor: Actor, id: string, motivo: string) {
  return transaccion(async () => {
    const r = await repo.revocarCredencial(id, actor.usuarioId);
    if (!r) {
      const existe = await repo.obtenerCredencial(id);
      if (!existe) throw new NotFoundError('La credencial no existe');
      throw new ValidationError('La credencial ya estaba revocada');
    }
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'revocar', entidad: 'credenciales_qr', registroId: id, motivo, resultado: 'ok' });
    return r;
  });
}
