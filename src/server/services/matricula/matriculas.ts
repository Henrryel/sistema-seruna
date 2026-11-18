import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/matricula/matriculas';
import * as repoEstudiantes from '@/server/repositories/matricula/estudiantes';
import * as repoReglas from '@/server/repositories/matricula/reglas';
import * as repoApoderados from '@/server/repositories/matricula/apoderados';
import * as repoDocumentos from '@/server/repositories/matricula/documentos';
import * as repoPersonas from '@/server/repositories/matricula/personas';
import { formatoFecha, sumarDias } from '@/lib/formato';
import type { Actor } from '@/server/auth/actor';
import type {
  DatosAceptacion,
  DatosAnulacion,
  DatosCambioSeccion,
  DatosConfirmacion,
  DatosReincorporacion,
  DatosResponsable,
  DatosRetiro,
  DatosSolicitud,
  DetalleMatricula,
} from '@/esquemas/matricula/matriculas';
import { conMensajes, edadAl, guardarOpcional, hoy, type ArchivoSubido } from './comun';

// Máquina de estados de la matrícula (la base no la tiene: discrepancias.md §16).
//   solicitada → activa (confirmación) → retirada | trasladada → activa (reincorporación)
//   solicitada | activa → anulada
// Cada transición = estado + ubicación en matricula_secciones + movimiento, en UNA transacción auditada.
// La base valida: sección activa, vigencia dentro del año, cupos (trigger controlar_cupo), solapes
// (EXCLUDE), coherencia año/grado de la sección (FK compuesta) y confirmada_en (CHECK).

export const listarMatriculas = repo.listarMatriculas;
export const nomina = repo.nomina;

type Matricula = NonNullable<Awaited<ReturnType<typeof repo.obtenerMatricula>>>;

export async function obtenerMatricula(id: string, bloquear = false): Promise<Matricula> {
  const m = await repo.obtenerMatricula(id, bloquear);
  if (!m) throw new NotFoundError('La matrícula no existe');
  return m;
}

function exigirEstado(m: Matricula, estados: readonly string[], accion: string) {
  if (!estados.includes(m.estado)) throw new ConflictError(`No se puede ${accion}: la matrícula está ${m.estado}`);
}

/** Fecha efectiva de un movimiento dentro del año académico (movimientos_matricula no la valida). */
function exigirFechaEnAnio(m: Matricula, fecha: string) {
  if (fecha < m.anio_inicio || fecha > m.anio_fin) {
    throw new ValidationError(`La fecha debe estar dentro del año académico (${formatoFecha(m.anio_inicio)} al ${formatoFecha(m.anio_fin)})`);
  }
}

async function nombreSeccion(id: string) {
  const s = await repo.obtenerSeccion(id);
  if (!s) throw new NotFoundError('La sección no existe');
  return `${s.nombre} (${s.turno})`;
}

async function auditar(actor: Actor, accion: string, matriculaId: string, motivo?: string | null) {
  await registrarBitacora({ actorId: actor.usuarioId, accion, entidad: 'matriculas', registroId: matriculaId, motivo: motivo ?? null, resultado: 'ok' });
}

/**
 * Solicitud: toma la regla publicada vigente (mayor versión) y valida la ventana de solicitudes y la
 * edad al corte, que la base NO valida.
 */
export async function solicitarMatricula(actor: Actor, datos: DatosSolicitud, fechaSolicitud = hoy()) {
  const est = await repoEstudiantes.obtenerEstudiante(datos.estudianteId);
  if (!est) throw new NotFoundError('El estudiante no existe');
  if (!est.activo) throw new ValidationError('El estudiante está inactivo');
  const regla = await repoReglas.reglaVigente(datos.anioId, datos.gradoId, datos.tipoIngreso);
  if (!regla) throw new ValidationError('No hay una regla de matrícula publicada para ese año, grado y tipo de ingreso');
  if (fechaSolicitud < regla.solicitudes_inicio || fechaSolicitud > regla.solicitudes_fin) {
    throw new ValidationError(
      `Fuera de la ventana de solicitudes de la regla (del ${formatoFecha(regla.solicitudes_inicio)} al ${formatoFecha(regla.solicitudes_fin)})`,
    );
  }
  if (regla.edad_minima !== null || regla.edad_maxima !== null) {
    if (!est.fecha_nacimiento) throw new ValidationError('Registre la fecha de nacimiento del estudiante: la regla exige una edad al corte');
    const corte = regla.corte_edad ?? fechaSolicitud;
    const edad = edadAl(est.fecha_nacimiento, corte);
    if ((regla.edad_minima !== null && edad < regla.edad_minima) || (regla.edad_maxima !== null && edad > regla.edad_maxima)) {
      const rango =
        regla.edad_minima !== null && regla.edad_maxima !== null
          ? `entre ${regla.edad_minima} y ${regla.edad_maxima} años`
          : regla.edad_minima !== null
            ? `al menos ${regla.edad_minima} años`
            : `como máximo ${regla.edad_maxima} años`;
      throw new ValidationError(`El estudiante tiene ${edad} años al ${formatoFecha(corte)}; la regla exige ${rango}`);
    }
  }
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.crearMatricula({
        estudianteId: datos.estudianteId,
        anioId: datos.anioId,
        gradoId: datos.gradoId,
        reglaId: regla.id,
        tipoIngreso: datos.tipoIngreso,
        referenciaSiagie: datos.referenciaSiagie,
        registradoPor: actor.usuarioId,
      });
      await auditar(actor, 'solicitar', r.id, `regla ${regla.id} v${regla.version}`);
      return { id: r.id, reglaId: regla.id };
    }),
  );
}

/** Confirmación: estado activa + confirmada_en + ubicación [fecha, fin de año] + movimiento. */
export async function confirmarMatricula(actor: Actor, id: string, datos: DatosConfirmacion) {
  return conMensajes(() =>
    transaccion(async () => {
      const m = await obtenerMatricula(id, true);
      exigirEstado(m, ['solicitada'], 'confirmar');
      exigirFechaEnAnio(m, datos.fecha);
      const seccion = await nombreSeccion(datos.seccionId);
      await repo.cambiarEstado(id, 'activa', { confirmar: true });
      const u = await repo.crearUbicacion({
        matriculaId: id,
        seccionId: datos.seccionId,
        anioId: m.anio_id,
        gradoId: m.grado_id,
        desde: datos.fecha,
        hastaExclusivo: sumarDias(m.anio_fin, 1),
        tipoVacante: datos.tipoVacante,
        registradoPor: actor.usuarioId,
      });
      await repo.registrarMovimiento({
        matriculaId: id,
        tipo: 'confirmacion',
        fechaEfectiva: datos.fecha,
        motivo: datos.motivo ?? 'Confirmación de matrícula',
        detalle: `Sección ${seccion} · vacante ${datos.tipoVacante}`,
        registradoPor: actor.usuarioId,
      });
      await auditar(actor, 'confirmar', id);
      return { id, ubicacionId: u.id };
    }),
  );
}

/** Cambio de sección: cierra la ubicación vigente el día previo y abre la nueva hasta el mismo fin. */
export async function cambiarSeccion(actor: Actor, id: string, datos: DatosCambioSeccion) {
  return conMensajes(() =>
    transaccion(async () => {
      const m = await obtenerMatricula(id, true);
      exigirEstado(m, ['activa'], 'cambiar de sección');
      exigirFechaEnAnio(m, datos.fecha);
      const actual = await repo.ubicacionEn(id, datos.fecha);
      if (!actual) throw new ValidationError('La matrícula no tiene una sección vigente en esa fecha');
      if (actual.seccion_id === datos.seccionId) throw new ValidationError('El estudiante ya está en esa sección');
      if (actual.desde >= datos.fecha) {
        throw new ValidationError(`El cambio debe ser posterior al inicio de la ubicación actual (${formatoFecha(actual.desde)})`);
      }
      const [anterior, nueva] = [await nombreSeccion(actual.seccion_id), await nombreSeccion(datos.seccionId)];
      await repo.cerrarUbicacion(actual.id, datos.fecha);
      const u = await repo.crearUbicacion({
        matriculaId: id,
        seccionId: datos.seccionId,
        anioId: m.anio_id,
        gradoId: m.grado_id,
        desde: datos.fecha,
        hastaExclusivo: actual.hasta_exclusivo,
        tipoVacante: datos.tipoVacante,
        registradoPor: actor.usuarioId,
      });
      await repo.registrarMovimiento({
        matriculaId: id,
        tipo: 'cambio_seccion',
        fechaEfectiva: datos.fecha,
        motivo: datos.motivo,
        detalle: [`${anterior} → ${nueva}`, datos.detalle].filter(Boolean).join(' · '),
        registradoPor: actor.usuarioId,
      });
      await auditar(actor, 'cambiar_seccion', id, datos.motivo);
      return { id, ubicacionId: u.id };
    }),
  );
}

/** Retiro o traslado: cierra la ubicación el día previo a la fecha efectiva, cambia el estado y registra el movimiento. */
export async function retirarMatricula(actor: Actor, id: string, datos: DatosRetiro, evidencia?: ArchivoSubido | null) {
  return conMensajes(() =>
    transaccion(async () => {
      const m = await obtenerMatricula(id, true);
      exigirEstado(m, ['activa'], datos.tipo === 'retiro' ? 'retirar' : 'trasladar');
      exigirFechaEnAnio(m, datos.fecha);
      for (const u of await repo.ubicacionesDesde(id, datos.fecha)) {
        if (u.desde >= datos.fecha) {
          throw new ValidationError(
            `La fecha efectiva debe ser posterior al inicio de la ubicación en la sección (${formatoFecha(u.desde)}). Si el estudiante no llegó a asistir, anule la matrícula.`,
          );
        }
        await repo.cerrarUbicacion(u.id, datos.fecha);
      }
      const evidenciaId = await guardarOpcional(evidencia);
      await repo.cambiarEstado(id, datos.tipo === 'retiro' ? 'retirada' : 'trasladada');
      const mov = await repo.registrarMovimiento({
        matriculaId: id,
        tipo: datos.tipo,
        fechaEfectiva: datos.fecha,
        motivo: datos.motivo,
        detalle: datos.detalle,
        evidenciaId,
        registradoPor: actor.usuarioId,
      });
      await auditar(actor, datos.tipo === 'retiro' ? 'retirar' : 'trasladar', id, datos.motivo);
      return { id, movimientoId: mov.id, evidenciaId };
    }),
  );
}

/** Reincorporación: nueva ubicación [fecha, fin de año], estado activa y movimiento. */
export async function reincorporarMatricula(actor: Actor, id: string, datos: DatosReincorporacion) {
  return conMensajes(() =>
    transaccion(async () => {
      const m = await obtenerMatricula(id, true);
      exigirEstado(m, ['retirada', 'trasladada'], 'reincorporar');
      exigirFechaEnAnio(m, datos.fecha);
      const seccion = await nombreSeccion(datos.seccionId);
      const u = await repo.crearUbicacion({
        matriculaId: id,
        seccionId: datos.seccionId,
        anioId: m.anio_id,
        gradoId: m.grado_id,
        desde: datos.fecha,
        hastaExclusivo: sumarDias(m.anio_fin, 1),
        tipoVacante: datos.tipoVacante,
        registradoPor: actor.usuarioId,
      });
      await repo.cambiarEstado(id, 'activa');
      await repo.registrarMovimiento({
        matriculaId: id,
        tipo: 'reincorporacion',
        fechaEfectiva: datos.fecha,
        motivo: datos.motivo,
        detalle: `Sección ${seccion}`,
        registradoPor: actor.usuarioId,
      });
      await auditar(actor, 'reincorporar', id, datos.motivo);
      return { id, ubicacionId: u.id };
    }),
  );
}

/**
 * Anulación (matrícula registrada por error): quita sus ubicaciones para liberar el cupo y queda
 * anulada. Si ya hay asistencia ligada a la ubicación, la base lo impide (FK): corresponde un retiro.
 */
export async function anularMatricula(actor: Actor, id: string, datos: DatosAnulacion) {
  return conMensajes(() =>
    transaccion(async () => {
      const m = await obtenerMatricula(id, true);
      exigirEstado(m, ['solicitada', 'activa'], 'anular');
      const quitadas = await repo.eliminarUbicaciones(id);
      await repo.cambiarEstado(id, 'anulada');
      await repo.registrarMovimiento({
        matriculaId: id,
        tipo: 'anulacion',
        fechaEfectiva: datos.fecha,
        motivo: datos.motivo,
        detalle: quitadas.length ? `Se liberaron ${quitadas.length} ubicación(es) en sección` : null,
        registradoPor: actor.usuarioId,
      });
      await auditar(actor, 'anular', id, datos.motivo);
      return { id };
    }),
  );
}

/** Nuevo responsable económico desde una fecha: el vigente en esa fecha se cierra el día previo. */
export async function registrarResponsable(actor: Actor, id: string, datos: DatosResponsable) {
  const m = await obtenerMatricula(id);
  exigirEstado(m, ['solicitada', 'activa', 'retirada', 'trasladada'], 'registrar el responsable económico');
  if (datos.personaId && !(await repoPersonas.obtenerPersona(datos.personaId))) throw new ValidationError('La persona seleccionada no existe');
  return conMensajes(() =>
    transaccion(async () => {
      const actual = await repo.responsableEn(id, datos.desde);
      if (actual) {
        if (actual.desde >= datos.desde) throw new ConflictError('Ya hay un responsable económico desde esa fecha; registre el cambio con una fecha posterior');
        await repo.cerrarResponsable(actual.id, datos.desde);
      }
      const r = await repo.crearResponsable({
        matriculaId: id,
        personaId: datos.personaId ?? null,
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: datos.numeroDocumento,
        nombreRazonSocial: datos.nombreRazonSocial,
        direccion: datos.direccion,
        desde: datos.desde,
      });
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'responsables_economicos', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}

/** Aceptación de un documento institucional publicado del año de la matrícula. */
export async function registrarAceptacion(actor: Actor, id: string, datos: DatosAceptacion, evidencia?: ArchivoSubido | null) {
  const m = await obtenerMatricula(id);
  exigirEstado(m, ['solicitada', 'activa'], 'registrar aceptaciones');
  const doc = await repoDocumentos.obtenerDocumentoInstitucional(datos.documentoId);
  if (!doc) throw new NotFoundError('El documento institucional no existe');
  if (!doc.publicado_en) throw new ConflictError('Solo se pueden aceptar documentos publicados');
  return conMensajes(() =>
    transaccion(async () => {
      const evidenciaId = await guardarOpcional(evidencia);
      const r = await repo.crearAceptacion({
        matriculaId: id,
        anioId: m.anio_id,
        gradoId: m.grado_id,
        documentoId: datos.documentoId,
        firmanteId: datos.firmanteId,
        metodo: datos.metodo,
        fecha: datos.fecha ?? null,
        evidenciaId,
      });
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'aceptar_documento', entidad: 'aceptaciones_documento', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}

export async function detalleMatricula(id: string): Promise<DetalleMatricula> {
  const matricula = await obtenerMatricula(id);
  const ubicaciones = await repo.listarUbicaciones(id);
  const movimientos = await repo.listarMovimientos(id);
  const responsables = await repo.listarResponsables({ matriculaId: id });
  const aceptaciones = await repo.listarAceptaciones(id);
  const documentos = await repoDocumentos.documentosPublicadosDelAnio(matricula.anio_id);
  const apoderados = await repoApoderados.listarApoderados(matricula.estudiante_id, true);
  return {
    matricula,
    ubicaciones,
    movimientos,
    responsables,
    aceptaciones,
    documentos,
    firmantes: apoderados.map((a) => ({ persona_id: a.persona_id, nombre: `${a.apellidos}, ${a.nombres}`, parentesco: a.parentesco })),
  };
}

/** Secciones del año y grado de la matrícula con ocupación en la fecha (por defecto hoy, acotada al año). */
export async function seccionesDeMatricula(id: string, fecha?: string) {
  const m = await obtenerMatricula(id);
  const dia = fecha ?? [hoy(), m.anio_inicio].sort().reverse()[0] ?? m.anio_inicio;
  const corte = dia > m.anio_fin ? m.anio_fin : dia;
  return { fecha: corte, secciones: await repo.seccionesConOcupacion(m.anio_id, m.grado_id, corte) };
}
