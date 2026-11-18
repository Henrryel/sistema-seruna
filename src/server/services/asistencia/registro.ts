import 'server-only';
import { transaccion } from '@/server/db';
import { aErrorDominio, ForbiddenError, NotFoundError, ValidationError } from '@/server/errores';
import {
  cursosDelDocente,
  docenteDelActor,
  estudianteDelActor,
  exigirAccesoEstudiante,
  exigirSeccionDelDocente,
} from '@/server/autorizacion/alcance';
import * as repo from '@/server/repositories/asistencia/registro';
import * as repoMarcaciones from '@/server/repositories/asistencia/marcaciones';
import type { Paginacion } from '@/server/http/listado';
import { hoyLima } from '@/lib/formato';
import type { Actor } from '@/server/auth/actor';
import type {
  DatosRegistroDiario,
  DatosRegistroDocente,
  DatosRegistroSesion,
  EstadoAsistencia,
  FilaDetalleAsistencia,
  ResultadoLote,
  ResumenAsistencia,
} from '@/esquemas/asistencia/registro';

// Servicio: registro/corrección manual de asistencia (sección por día, sesión de clase y docentes) y
// resúmenes para portales. El historial es inmutable: no se borra, se corrige con estado + motivo
// (obligatorio en la base). Cada cambio lo audita la base (trigger auditar_asistencia → bitacora, con
// registrado_por y motivo), por eso aquí no se duplica registrarBitacora.
// `validar_asistencia` decide si el cambio es coherente (marcaciones, tolerancia, política manual, etc.).

/** 'admin': permiso administrativo (ya verificado en la ruta). 'docente': solo sus secciones/sesiones. */
export type Contexto = 'admin' | 'docente';

async function exigirSeccion(actor: Actor, seccionId: string, contexto: Contexto) {
  if (contexto === 'docente') await exigirSeccionDelDocente(actor, seccionId);
}

// ── Diaria por sección ───────────────────────────────────────────────────────

export async function jornadaDeSeccion(actor: Actor, seccionId: string, fecha: string, contexto: Contexto) {
  await exigirSeccion(actor, seccionId, contexto);
  return (await repo.jornadaDeSeccion(seccionId, fecha)) ?? null;
}

export async function listarDiariaSeccion(actor: Actor, f: { seccionId: string; fecha: string; q?: string }, p: Paginacion | null, contexto: Contexto) {
  await exigirSeccion(actor, f.seccionId, contexto);
  return repo.listarDiariaSeccion(f, p);
}

async function guardarLote(
  registros: DatosRegistroDiario['registros'],
  guardar: (r: DatosRegistroDiario['registros'][number]) => Promise<'guardado' | 'sinCambios'>,
): Promise<ResultadoLote> {
  const resultado: ResultadoLote = { guardados: 0, sinCambios: 0, errores: [] };
  await transaccion(async () => {
    for (const r of registros) {
      try {
        // Cada alumno en su SAVEPOINT: un rechazo de la base no deshace a los demás.
        const estado = await transaccion(() => guardar(r));
        if (estado === 'guardado') resultado.guardados++;
        else resultado.sinCambios++;
      } catch (e) {
        const error = aErrorDominio(e);
        if (error.tipo === 'Interno') throw e;
        resultado.errores.push({ matriculaId: r.matriculaId, estudiante: null, mensaje: error.message });
      }
    }
  });
  return resultado;
}

export async function registrarDiario(actor: Actor, d: DatosRegistroDiario, contexto: Contexto): Promise<ResultadoLote> {
  const jornada = await repo.obtenerJornadaSeccion(d.jornadaId);
  if (!jornada) throw new NotFoundError('La jornada no existe');
  if (jornada.estado !== 'programada') throw new ValidationError('La jornada está cancelada');
  await exigirSeccion(actor, jornada.seccion_id, contexto);
  if (contexto === 'docente' && jornada.fecha > hoyLima()) throw new ValidationError('No puede registrar asistencia de una fecha futura');
  return guardarLote(d.registros, async (r) => {
    const ms = await repo.matriculaSeccionEnJornada(r.matriculaId, d.jornadaId);
    if (!ms) throw new ValidationError('El estudiante no pertenece a la sección en esa fecha');
    const actual = await repoMarcaciones.asistenciaDiariaAlumno(r.matriculaId, d.jornadaId);
    if (actual?.estado === r.estado) return 'sinCambios';
    if (actual) await repoMarcaciones.actualizarAsistenciaAlumno(actual.id, { estado: r.estado, registradoPor: actor.usuarioId, motivo: d.motivo });
    else
      await repoMarcaciones.insertarAsistenciaAlumno({
        matriculaId: r.matriculaId,
        matriculaSeccionId: ms.matricula_seccion_id,
        jornadaId: d.jornadaId,
        estado: r.estado,
        registradoPor: actor.usuarioId,
        motivo: d.motivo,
      });
    return 'guardado';
  });
}

// ── Por sesión de clase ──────────────────────────────────────────────────────

export async function listarSesiones(actor: Actor, f: { fecha: string; seccionId?: string }, contexto: Contexto) {
  if (contexto === 'docente') {
    const { docenteId } = await docenteDelActor(actor);
    return repo.listarSesiones({ fecha: f.fecha, docenteId, seccionId: f.seccionId });
  }
  if (!f.seccionId) throw new ValidationError('Seleccione la sección');
  return repo.listarSesiones({ fecha: f.fecha, seccionId: f.seccionId });
}

async function sesionAccesible(actor: Actor, sesionId: string, contexto: Contexto) {
  const s = await repo.obtenerSesion(sesionId);
  if (!s) throw new NotFoundError('La sesión de clase no existe');
  if (contexto === 'docente') {
    const { docenteId } = await docenteDelActor(actor);
    if (s.docente_id !== docenteId) throw new ForbiddenError('La sesión no es suya');
  }
  return s;
}

export async function obtenerSesion(actor: Actor, sesionId: string, contexto: Contexto) {
  const { docente_id: _docente, ...s } = await sesionAccesible(actor, sesionId, contexto);
  void _docente;
  return s;
}

export async function listarAsistenciaSesion(actor: Actor, f: { sesionId: string; q?: string }, p: Paginacion | null, contexto: Contexto) {
  const s = await sesionAccesible(actor, f.sesionId, contexto);
  if (!s.jornada_id) return { filas: [], total: 0 };
  return repo.listarAsistenciaSesion({ sesionId: f.sesionId, jornadaId: s.jornada_id, q: f.q }, p);
}

export async function registrarSesion(actor: Actor, sesionId: string, d: DatosRegistroSesion, contexto: Contexto): Promise<ResultadoLote> {
  const s = await sesionAccesible(actor, sesionId, contexto);
  if (s.estado === 'cancelada') throw new ValidationError('La sesión está cancelada');
  if (!s.jornada_id) throw new ValidationError('La sección no tiene jornada programada en la fecha de la sesión');
  if (contexto === 'docente' && s.fecha > hoyLima()) throw new ValidationError('No puede registrar asistencia de una fecha futura');
  const jornadaId = s.jornada_id;
  return guardarLote(d.registros, async (r) => {
    const ms = await repo.matriculaSeccionEnJornada(r.matriculaId, jornadaId);
    if (!ms) throw new ValidationError('El estudiante no pertenece a la sección en esa fecha');
    const actual = await repoMarcaciones.asistenciaSesionAlumno(r.matriculaId, sesionId);
    if (actual?.estado === r.estado) return 'sinCambios';
    if (actual) await repoMarcaciones.actualizarAsistenciaAlumno(actual.id, { estado: r.estado, registradoPor: actor.usuarioId, motivo: d.motivo });
    else
      await repoMarcaciones.insertarAsistenciaAlumno({
        matriculaId: r.matriculaId,
        matriculaSeccionId: ms.matricula_seccion_id,
        jornadaId,
        sesionId,
        estado: r.estado,
        registradoPor: actor.usuarioId,
        motivo: d.motivo,
      });
    return 'guardado';
  });
}

// ── Docentes ─────────────────────────────────────────────────────────────────

export const listarDiariaDocentes = repo.listarDiariaDocentes;

export async function registrarDocente(actor: Actor, d: DatosRegistroDocente) {
  const j = await repo.obtenerJornadaDocente(d.jornadaId);
  if (!j) throw new NotFoundError('La jornada no existe');
  if (j.estado !== 'programada') throw new ValidationError('La jornada está cancelada');
  return transaccion(async () => {
    const actual = await repoMarcaciones.asistenciaDocente(d.jornadaId);
    if (actual?.estado === d.estado) return { id: actual.id, estado: actual.estado, cambiado: false };
    const r = actual
      ? await repoMarcaciones.actualizarAsistenciaDocente(actual.id, { estado: d.estado, registradoPor: actor.usuarioId, motivo: d.motivo })
      : await repoMarcaciones.insertarAsistenciaDocente({ jornadaId: d.jornadaId, estado: d.estado, registradoPor: actor.usuarioId, motivo: d.motivo });
    return { ...r, cambiado: true };
  });
}

// ── Resúmenes (portales) ─────────────────────────────────────────────────────

function totales(filas: FilaDetalleAsistencia[]) {
  const t: Record<EstadoAsistencia, number> = { pendiente: 0, presente: 0, tarde: 0, ausente: 0, justificado: 0 };
  for (const f of filas) t[f.estado] = (t[f.estado] ?? 0) + 1;
  const conRegistro = t.presente + t.tarde + t.ausente + t.justificado;
  const porcentaje = conRegistro > 0 ? Math.round(((t.presente + t.tarde + t.justificado) / conRegistro) * 1000) / 10 : null;
  return { totales: t, porcentaje };
}

async function resumenDeEstudiante(estudianteId: string, f: { desde?: string; hasta?: string }): Promise<ResumenAsistencia> {
  const rango = { desde: f.desde, hasta: f.hasta && f.hasta < hoyLima() ? f.hasta : hoyLima() };
  const [diaria, sesiones, justificaciones] = await Promise.all([
    repo.detalleDiarioAlumno(estudianteId, rango),
    repo.detalleSesionesAlumno(estudianteId, rango),
    repo.justificacionesDeEstudiante(estudianteId),
  ]);
  return { ...totales(diaria), diaria, sesiones, justificaciones };
}

/** Alumno: solo su propio registro. */
export async function resumenPropioAlumno(actor: Actor, f: { desde?: string; hasta?: string }) {
  const { estudianteId } = await estudianteDelActor(actor);
  return resumenDeEstudiante(estudianteId, f);
}

/** Apoderado: hijo con vínculo vigente y acceso académico. */
export async function resumenHijo(actor: Actor, estudianteId: string, f: { desde?: string; hasta?: string }) {
  await exigirAccesoEstudiante(actor, estudianteId, { portal: 'padre', tipo: 'academico' });
  return resumenDeEstudiante(estudianteId, f);
}

/** Docente: su propia asistencia y justificaciones. */
export async function resumenPropioDocente(actor: Actor, f: { desde?: string; hasta?: string }): Promise<ResumenAsistencia> {
  const { docenteId } = await docenteDelActor(actor);
  const rango = { desde: f.desde, hasta: f.hasta && f.hasta < hoyLima() ? f.hasta : hoyLima() };
  const [diaria, justificaciones] = await Promise.all([repo.detalleDocente(docenteId, rango), repo.justificacionesDeDocente(docenteId)]);
  return { ...totales(diaria), diaria, sesiones: [], justificaciones };
}

/** Secciones asignadas al docente (para el selector del portal docente). */
export async function seccionesDelDocente(actor: Actor, fecha: string) {
  const cursos = await cursosDelDocente(actor, fecha);
  const vistas = new Map<string, { id: string; etiqueta: string }>();
  for (const c of cursos) {
    if (!vistas.has(c.seccion_id)) vistas.set(c.seccion_id, { id: c.seccion_id, etiqueta: `${c.grado}.º ${c.seccion} ${c.nivel}` });
  }
  return [...vistas.values()];
}
