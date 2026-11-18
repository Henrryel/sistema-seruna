import 'server-only';
import { transaccion } from '@/server/db';
import { aErrorDominio, ConflictError, NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/academico/horarios';
import { obtenerAsignacion, obtenerCurso } from '@/server/repositories/academico/asignaciones';
import { rango } from '@/server/repositories/academico/comunes';
import type { Actor } from '@/server/auth/actor';
import type {
  DatosActualizarBloque,
  DatosBloque,
  DatosGenerarSesiones,
  DatosSesion,
  EstadoSesion,
  ResultadoGeneracion,
} from '@/esquemas/academico/horarios';
import { conMensajes } from './restricciones';

// Horarios y sesiones de clase. Los choques (sección/docente/aula), las horas y la vigencia dentro del plan
// y de la asignación los rechaza la base; aquí solo se arma el registro con los datos derivados.

export const listarSesiones = repo.listarSesiones;

export async function horarioDeSeccion(seccionId: string, fecha?: string) {
  const ref = await repo.fechaReferenciaSeccion(seccionId, fecha);
  if (!ref) throw new NotFoundError('La sección no existe');
  const [seccion, bloques] = await Promise.all([repo.etiquetaSeccion(seccionId), repo.bloquesDeSeccion(seccionId, ref)]);
  return { fecha: ref, seccion: seccion ? { id: seccionId, etiqueta: seccion.etiqueta, turno: seccion.turno } : null, bloques };
}

async function exigirAsignacion(id: string) {
  const a = await obtenerAsignacion(id);
  if (!a) throw new NotFoundError('La asignación docente no existe');
  return a;
}

async function exigirCurso(id: string) {
  const c = await obtenerCurso(id);
  if (!c) throw new NotFoundError('El curso no existe');
  return c;
}

export async function crearBloque(actor: Actor, d: DatosBloque) {
  const [curso, asignacion] = await Promise.all([exigirCurso(d.cursoId), exigirAsignacion(d.asignacionId)]);
  return transaccion(async () => {
    const r = await conMensajes(() =>
      repo.crearBloque({
        cursoId: curso.id,
        asignacionId: asignacion.id,
        seccionId: curso.seccion_id,
        docenteId: asignacion.docente_id,
        aulaId: d.aulaId ?? null,
        diaIso: d.diaIso,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
        vigencia: rango(d.inicio, d.fin),
      }),
    );
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'crear',
      entidad: 'bloques_horario',
      registroId: r.id,
      motivo: `curso ${curso.id}, día ${d.diaIso} ${d.horaInicio}-${d.horaFin}`,
      resultado: 'ok',
    });
    return r;
  });
}

export async function actualizarBloque(actor: Actor, id: string, d: DatosActualizarBloque) {
  return transaccion(async () => {
    const r = await conMensajes(() =>
      repo.actualizarBloque(id, { aulaId: d.aulaId ?? null, diaIso: d.diaIso, horaInicio: d.horaInicio, horaFin: d.horaFin, vigencia: rango(d.inicio, d.fin) }),
    );
    if (!r) throw new NotFoundError('El bloque no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'actualizar', entidad: 'bloques_horario', registroId: id, motivo: `día ${d.diaIso} ${d.horaInicio}-${d.horaFin}`, resultado: 'ok' });
    return r;
  });
}

export async function eliminarBloque(actor: Actor, id: string) {
  return transaccion(async () => {
    const r = await conMensajes(() => repo.eliminarBloque(id));
    if (!r) throw new NotFoundError('El bloque no existe');
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'eliminar', entidad: 'bloques_horario', registroId: id, resultado: 'ok' });
    return r;
  });
}

/**
 * Genera sesiones programadas a partir de los bloques de la sección en el rango. Omite días no lectivos del
 * calendario y sesiones ya generadas. Cada sesión se inserta en su propio SAVEPOINT: si la base rechaza
 * una (choque o fuera de vigencia), se informa y se continúa con las demás.
 */
export async function generarSesiones(actor: Actor, d: DatosGenerarSesiones): Promise<ResultadoGeneracion> {
  const candidatos = await repo.candidatosSesiones({ seccionId: d.seccionId, cursoId: d.cursoId, desde: d.desde, hasta: d.hasta });
  return transaccion(async () => {
    const resultado: ResultadoGeneracion = { creadas: 0, existentes: 0, omitidas: [], diasSinClase: 0 };
    const sinClase = new Set<string>();
    for (const c of candidatos) {
      if (!c.lectivo) {
        sinClase.add(c.fecha);
        continue;
      }
      if (c.existe) {
        resultado.existentes++;
        continue;
      }
      try {
        await transaccion(() =>
          conMensajes(() =>
            repo.crearSesion({
              cursoId: c.curso_id,
              seccionId: c.seccion_id,
              bloqueId: c.bloque_id,
              asignacionId: c.asignacion_id,
              docenteId: c.docente_id,
              aulaId: c.aula_id,
              fecha: c.fecha,
              horaInicio: c.hora_inicio,
              horaFin: c.hora_fin,
            }),
          ),
        );
        resultado.creadas++;
      } catch (e) {
        const error = aErrorDominio(e);
        if (error.tipo === 'Interno') throw e;
        if (resultado.omitidas.length < 100) resultado.omitidas.push({ fecha: c.fecha, asignatura: c.asignatura, motivo: error.message });
      }
    }
    resultado.diasSinClase = sinClase.size;
    await registrarBitacora({
      actorId: actor.usuarioId,
      accion: 'generar_sesiones',
      entidad: 'sesiones_clase',
      registroId: d.seccionId,
      motivo: `${d.desde} – ${d.hasta}: ${resultado.creadas} creada(s), ${resultado.omitidas.length} omitida(s)`,
      resultado: 'ok',
    });
    return resultado;
  });
}

export async function crearSesion(actor: Actor, d: DatosSesion) {
  const asignacion = await exigirAsignacion(d.asignacionId);
  const curso = await exigirCurso(asignacion.curso_id);
  return transaccion(async () => {
    const r = await conMensajes(() =>
      repo.crearSesion({
        cursoId: curso.id,
        seccionId: curso.seccion_id,
        bloqueId: d.bloqueId ?? null,
        asignacionId: asignacion.id,
        docenteId: asignacion.docente_id,
        aulaId: d.aulaId ?? null,
        fecha: d.fecha,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
      }),
    );
    await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'sesiones_clase', registroId: r.id, motivo: `${d.fecha} ${d.horaInicio}-${d.horaFin}`, resultado: 'ok' });
    return r;
  });
}

/** Transiciones permitidas: programada → realizada | cancelada; cancelada → programada (reprogramar). */
const TRANSICIONES: Record<string, EstadoSesion[]> = {
  programada: ['realizada', 'cancelada'],
  cancelada: ['programada'],
  realizada: [],
};

export async function cambiarEstadoSesion(actor: Actor, id: string, estado: EstadoSesion) {
  const s = await repo.obtenerSesion(id);
  if (!s) throw new NotFoundError('La sesión no existe');
  if (s.estado === estado) return { id, estado };
  if (!TRANSICIONES[s.estado]?.includes(estado)) throw new ConflictError(`Una sesión ${s.estado} no puede pasar a ${estado}`);
  return transaccion(async () => {
    const r = await conMensajes(() => repo.cambiarEstadoSesion(id, estado));
    await registrarBitacora({ actorId: actor.usuarioId, accion: `marcar_${estado}`, entidad: 'sesiones_clase', registroId: id, motivo: `${s.estado} → ${estado}`, resultado: 'ok' });
    return r;
  });
}
