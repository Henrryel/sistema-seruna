import 'server-only';
import { transaccion } from '@/server/db';
import { aErrorDominio } from '@/server/errores';
import { exigirPermiso } from '@/server/autorizacion/permisos';
import * as repo from '@/server/repositories/asistencia/marcaciones';
import { proveedorQr, type AttendanceProvider, type MarcacionRegistrada } from '@/server/asistencia/proveedor';
import { estadoPorEntrada } from '@/server/asistencia/estado';
import { nombreCompleto } from '@/lib/formato';
import type { Actor } from '@/server/auth/actor';
import type { DatosMarcar, EventoOffline, ResultadoMarcacion, ResultadoSincronizacion } from '@/esquemas/asistencia/marcaciones';

// Servicio de marcaciones.
// 1) `registrar_marcacion` (vía el proveedor) inserta SOLO la marcación (idempotente por evento_uuid).
// 2) En un SAVEPOINT (transaccion() anidada) se crea o actualiza la asistencia diaria de la persona.
//    Si no hay jornada o `validar_asistencia` la rechaza, la marcación queda registrada y se informa el motivo.
// La base no verifica el permiso `asistencia.marcar` (solo que el operador esté activo): se exige aquí.

type ResultadoAsistencia = ResultadoMarcacion['asistencia'];
type Perfiles = Awaited<ReturnType<typeof repo.perfilesDePersona>>;

function motivoAsistencia(m: MarcacionRegistrada): string {
  return m.metodo === 'qr' ? `Marcación QR de ${m.tipo}` : `Marcación de ${m.tipo}: ${m.motivo ?? 'manual'}`;
}

async function aplicarAlumno(actor: Actor, m: MarcacionRegistrada, estudianteId: string): Promise<ResultadoAsistencia | null> {
  const mat = await repo.matriculaEnFecha(estudianteId, m.fecha_local);
  if (!mat) return null;
  const j = await repo.jornadaSeccionEnFecha(mat.seccion_id, m.fecha_local);
  if (!j) return { registrada: false, estado: null, mensaje: `La sección ${mat.seccion} no tiene jornada programada para esta fecha` };
  const actual = await repo.asistenciaDiariaAlumno(mat.matricula_id, j.id);
  const motivo = motivoAsistencia(m);

  if (m.tipo === 'entrada') {
    if (actual?.entrada_id) {
      return actual.entrada_id === m.id
        ? { registrada: true, estado: actual.estado, mensaje: 'Entrada ya registrada' }
        : { registrada: false, estado: actual.estado, mensaje: 'Ya tenía una entrada registrada en esta jornada' };
    }
    // Misma fórmula que verifica validar_asistencia (tolerancia de la política de la jornada).
    const calculado = estadoPorEntrada({ instanteLocal: m.instante_local, fecha: j.fecha, horaEntrada: j.entrada, toleranciaMinutos: j.tolerancia_minutos });
    // Con justificación aprobada el estado debe seguir siendo "justificado" (lo exige la base).
    const estado = actual?.estado === 'justificado' ? 'justificado' : calculado;
    const r = actual
      ? await repo.actualizarAsistenciaAlumno(actual.id, { estado, entradaId: m.id, registradoPor: actor.usuarioId, motivo })
      : await repo.insertarAsistenciaAlumno({
          matriculaId: mat.matricula_id,
          matriculaSeccionId: mat.matricula_seccion_id,
          jornadaId: j.id,
          estado,
          entradaId: m.id,
          registradoPor: actor.usuarioId,
          motivo,
        });
    return { registrada: true, estado: r.estado, mensaje: calculado === 'tarde' ? 'Entrada registrada con tardanza' : 'Entrada registrada' };
  }

  if (actual?.salida_id) {
    return actual.salida_id === m.id
      ? { registrada: true, estado: actual.estado, mensaje: 'Salida ya registrada' }
      : { registrada: false, estado: actual.estado, mensaje: 'Ya tenía una salida registrada en esta jornada' };
  }
  const r = actual
    ? await repo.actualizarAsistenciaAlumno(actual.id, { salidaId: m.id, registradoPor: actor.usuarioId, motivo })
    : await repo.insertarAsistenciaAlumno({
        matriculaId: mat.matricula_id,
        matriculaSeccionId: mat.matricula_seccion_id,
        jornadaId: j.id,
        estado: 'pendiente',
        salidaId: m.id,
        registradoPor: actor.usuarioId,
        motivo: `${motivo} (sin entrada registrada)`,
      });
  return { registrada: true, estado: r.estado, mensaje: actual ? 'Salida registrada' : 'Salida registrada (no tenía entrada)' };
}

async function aplicarDocente(actor: Actor, m: MarcacionRegistrada, docenteId: string): Promise<ResultadoAsistencia | null> {
  const jornadas = await repo.jornadasDocenteEnFecha(docenteId, m.fecha_local);
  if (jornadas.length === 0) return null;
  const hora = m.instante_local.slice(11);
  const motivo = motivoAsistencia(m);

  if (m.tipo === 'entrada') {
    const repetida = jornadas.find((j) => j.entrada_id === m.id);
    if (repetida) return { registrada: true, estado: repetida.asistencia_estado, mensaje: 'Entrada ya registrada' };
    // La primera jornada del día que aún no terminó y no tiene entrada.
    const j = jornadas.find((x) => !x.entrada_id && hora < x.salida) ?? jornadas.find((x) => !x.entrada_id);
    if (!j) return { registrada: false, estado: jornadas[0]?.asistencia_estado ?? null, mensaje: 'Ya tenía una entrada registrada en su jornada' };
    const calculado = estadoPorEntrada({ instanteLocal: m.instante_local, fecha: j.fecha, horaEntrada: j.entrada, toleranciaMinutos: j.tolerancia_minutos });
    const estado = j.asistencia_estado === 'justificado' ? 'justificado' : calculado;
    const r = j.asistencia_id
      ? await repo.actualizarAsistenciaDocente(j.asistencia_id, { estado, entradaId: m.id, registradoPor: actor.usuarioId, motivo })
      : await repo.insertarAsistenciaDocente({ jornadaId: j.id, estado, entradaId: m.id, registradoPor: actor.usuarioId, motivo });
    return { registrada: true, estado: r.estado, mensaje: calculado === 'tarde' ? 'Entrada registrada con tardanza' : 'Entrada registrada' };
  }

  const repetida = jornadas.find((j) => j.salida_id === m.id);
  if (repetida) return { registrada: true, estado: repetida.asistencia_estado, mensaje: 'Salida ya registrada' };
  // La última jornada ya iniciada con entrada y sin salida; si no, la última iniciada sin salida.
  const iniciadas = jornadas.filter((x) => x.entrada <= hora && !x.salida_id);
  const j = iniciadas.filter((x) => x.entrada_id).at(-1) ?? iniciadas.at(-1) ?? jornadas.filter((x) => !x.salida_id).at(0);
  if (!j) return { registrada: false, estado: jornadas.at(-1)?.asistencia_estado ?? null, mensaje: 'Ya tenía una salida registrada en su jornada' };
  const r = j.asistencia_id
    ? await repo.actualizarAsistenciaDocente(j.asistencia_id, { salidaId: m.id, registradoPor: actor.usuarioId, motivo })
    : await repo.insertarAsistenciaDocente({ jornadaId: j.id, estado: 'pendiente', salidaId: m.id, registradoPor: actor.usuarioId, motivo: `${motivo} (sin entrada registrada)` });
  return { registrada: true, estado: r.estado, mensaje: j.asistencia_id ? 'Salida registrada' : 'Salida registrada (no tenía entrada)' };
}

/** Crea o actualiza la asistencia diaria a partir de la marcación (alumno → su sección; docente → su jornada). */
async function aplicarMarcacion(actor: Actor, m: MarcacionRegistrada, p: Perfiles): Promise<ResultadoAsistencia> {
  if (p.estudiante?.activo) {
    const r = await aplicarAlumno(actor, m, p.estudiante.id);
    if (r) return r;
  }
  if (p.docente?.activo) {
    const r = await aplicarDocente(actor, m, p.docente.id);
    if (r) return r;
  }
  if (p.estudiante?.activo && !p.docente?.activo) {
    return { registrada: false, estado: null, mensaje: 'El estudiante no tiene matrícula confirmada en una sección para esta fecha' };
  }
  return { registrada: false, estado: null, mensaje: 'No hay jornada programada para esta persona en esta fecha' };
}

async function completar(actor: Actor, m: MarcacionRegistrada): Promise<ResultadoMarcacion> {
  const p = await repo.perfilesDePersona(m.persona_id);
  let asistencia: ResultadoAsistencia;
  try {
    // SAVEPOINT: si la base rechaza la asistencia, la marcación ya registrada se conserva.
    asistencia = await transaccion(() => aplicarMarcacion(actor, m, p));
  } catch (e) {
    const error = aErrorDominio(e);
    if (error.tipo === 'Interno') console.error('[seruna] asistencia por marcación', e);
    asistencia = { registrada: false, estado: null, mensaje: error.tipo === 'Interno' ? 'No se pudo registrar la asistencia' : error.message };
  }
  const perfil = p.estudiante?.activo ? 'alumno' : p.docente?.activo ? 'docente' : null;
  let detalle: string | null = null;
  if (perfil === 'alumno' && p.estudiante) detalle = (await repo.matriculaEnFecha(p.estudiante.id, m.fecha_local))?.seccion ?? null;
  if (perfil === 'docente') detalle = 'Docente';
  return {
    eventoUuid: m.evento_uuid,
    marcacionId: m.id,
    tipo: m.tipo,
    metodo: m.metodo,
    instante: new Date(m.instante).toISOString(),
    persona: {
      id: m.persona_id,
      nombre: p.persona ? nombreCompleto(p.persona) : '—',
      perfil,
      codigo: perfil === 'alumno' ? (p.estudiante?.codigo ?? null) : perfil === 'docente' ? (p.docente?.codigo ?? null) : null,
      detalle,
    },
    asistencia,
  };
}

/** Marcación en línea desde el escáner (QR / Code 128 por cámara o lector USB). */
export async function marcar(actor: Actor, d: DatosMarcar, proveedor: AttendanceProvider = proveedorQr): Promise<ResultadoMarcacion> {
  exigirPermiso(actor, 'asistencia.marcar');
  return transaccion(async () => {
    const m = await proveedor.registrarEnLinea({ eventoUuid: d.eventoUuid, tipo: d.tipo, lectorId: d.lectorId, dato: d.codigo, actorId: actor.usuarioId });
    return completar(actor, m);
  });
}

/**
 * Sincroniza lecturas capturadas sin conexión. Cada evento va en su propia transacción: uno rechazado
 * no impide los demás. Idempotente por evento_uuid (reintentar el mismo lote no duplica nada).
 */
export async function sincronizar(actor: Actor, eventos: EventoOffline[], proveedor: AttendanceProvider = proveedorQr): Promise<{ resultados: ResultadoSincronizacion[] }> {
  exigirPermiso(actor, 'asistencia.marcar');
  const resultados: ResultadoSincronizacion[] = [];
  for (const ev of eventos) {
    try {
      const resultado = await transaccion(async () => {
        const m = await proveedor.registrarDiferida({
          eventoUuid: ev.eventoUuid,
          tipo: ev.tipo,
          lectorId: ev.lectorId,
          dato: ev.codigo,
          actorId: actor.usuarioId,
          capturadoEn: ev.capturadoEn,
        });
        return completar(actor, m);
      });
      resultados.push({ eventoUuid: ev.eventoUuid, ok: true, definitivo: true, resultado });
    } catch (e) {
      const error = aErrorDominio(e);
      if (error.tipo === 'Interno') console.error('[seruna] sincronización de marcación', e);
      resultados.push({ eventoUuid: ev.eventoUuid, ok: false, definitivo: error.tipo !== 'Interno', error: error.tipo === 'Interno' ? 'Error temporal; se reintentará' : error.message });
    }
  }
  return { resultados };
}
