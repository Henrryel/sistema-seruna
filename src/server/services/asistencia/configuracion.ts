import 'server-only';
import { transaccion } from '@/server/db';
import { NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/asistencia/configuracion';
import type { Actor } from '@/server/auth/actor';
import type {
  DatosGenerarJornadas,
  DatosLector,
  DatosPolitica,
  ResultadoGeneracion,
  TipoJornada,
} from '@/esquemas/asistencia/configuracion';

// Servicio: políticas, jornadas y lectores. Solapes de políticas (EXCLUDE), fechas de jornada dentro del
// año y la vigencia (trigger validar_fecha_jornada) y solapes de jornadas docentes los valida la base.

export const listarPoliticas = repo.listarPoliticas;
export const listarJornadas = repo.listarJornadas;
export const listarLectores = repo.listarLectores;
export const lectoresActivos = repo.lectoresActivos;
export const opcionesGeneracion = repo.opcionesGeneracion;

export async function crearPolitica(actor: Actor, d: DatosPolitica) {
  return transaccion(async () => {
    const r = await repo.crearPolitica(d);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'politicas_asistencia', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarPolitica(actor: Actor, id: string, d: DatosPolitica) {
  return transaccion(async () => {
    const r = await repo.actualizarPolitica(id, d);
    if (!r) throw new NotFoundError('La política de asistencia no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'politicas_asistencia', registroId: id, resultado: 'ok' });
    return r;
  });
}

/**
 * Generación masiva de jornadas para un rango: días lectivos del calendario escolar del año (o lunes a
 * viernes sin feriados si el calendario no tiene días lectivos), recortados al año y a la vigencia de la
 * política. Las jornadas que ya existen (o se solapan, en docentes) se omiten.
 */
export async function generarJornadas(actor: Actor, d: DatosGenerarJornadas): Promise<ResultadoGeneracion> {
  const politica = await repo.obtenerPolitica(d.politicaId);
  if (!politica) throw new NotFoundError('La política de asistencia no existe');
  const esperado = d.tipo === 'seccion' ? 'alumno' : 'docente';
  if (politica.alcance !== esperado) {
    throw new ValidationError(d.tipo === 'seccion' ? 'Elija una política de alcance "alumno" para las secciones' : 'Elija una política de alcance "docente"');
  }
  return transaccion(async () => {
    const { fechas, calendario } = await repo.fechasParaJornadas(d.politicaId, d.desde, d.hasta);
    const base = { politicaId: d.politicaId, anioId: politica.anio_id, fechas, entrada: d.entrada, salida: d.salida };
    const creadas =
      d.tipo === 'seccion'
        ? await repo.generarJornadasSeccion({ ...base, seccionIds: d.seccionIds })
        : await repo.generarJornadasDocente({ ...base, docenteIds: d.docenteIds });
    const destinos = d.tipo === 'seccion' ? d.seccionIds.length : d.docenteIds.length;
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'generar',
      entidad: d.tipo === 'seccion' ? 'jornadas_seccion' : 'jornadas_docente',
      registroId: d.politicaId,
      motivo: `${d.desde} a ${d.hasta}, ${d.entrada}–${d.salida}, ${destinos} destino(s), ${creadas} creada(s)`,
      resultado: 'ok',
    });
    return {
      fechas: fechas.length,
      creadas,
      omitidas: Math.max(0, fechas.length * destinos - creadas),
      fuente: calendario ? 'calendario' : 'lunes-viernes',
    };
  });
}

export async function cancelarJornada(actor: Actor, tipo: TipoJornada, id: string, motivo: string) {
  return transaccion(async () => {
    const r = await repo.cancelarJornada(tipo, id);
    if (!r) {
      const existe = await repo.existeJornada(tipo, id);
      if (!existe) throw new NotFoundError('La jornada no existe');
      throw new ValidationError('La jornada ya está cancelada');
    }
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'cancelar',
      entidad: tipo === 'seccion' ? 'jornadas_seccion' : 'jornadas_docente',
      registroId: id,
      motivo,
      resultado: 'ok',
    });
    return r;
  });
}

export async function crearLector(actor: Actor, d: DatosLector) {
  return transaccion(async () => {
    const r = await repo.crearLector(d);
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'lectores_qr', registroId: r.id, resultado: 'ok' });
    return r;
  });
}

export async function actualizarLector(actor: Actor, id: string, d: DatosLector) {
  return transaccion(async () => {
    const r = await repo.actualizarLector(id, d);
    if (!r) throw new NotFoundError('El lector no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'lectores_qr', registroId: id, resultado: 'ok' });
    return r;
  });
}

/** Solo si nunca registró marcaciones (la FK lo impide); si no, desactívelo. */
export async function eliminarLector(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await repo.eliminarLector(id);
    if (!r) throw new NotFoundError('El lector no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'lectores_qr', registroId: id, resultado: 'ok' });
    return r;
  });
}
