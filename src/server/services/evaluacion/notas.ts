import 'server-only';
import { transaccion } from '@/server/db';
import { ForbiddenError, NotFoundError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import { estudianteDelActor, exigirAccesoEstudiante, exigirAccesoMatricula } from '@/server/autorizacion/alcance';
import * as repo from '@/server/repositories/evaluacion/notas';
import { generarLibretasPdf } from '@/server/pdf/evaluacion/libreta';
import type { Actor } from '@/server/auth/actor';
import type { CompetenciaBoleta, DatosBoleta, RespuestaNotasPortal } from '@/esquemas/evaluacion/notas';

// Logros publicados (portales y libretas). Solo se exponen bimestres PUBLICADOS (vista reporte_notas_publicadas)
// y la situación final vigente (situaciones_finales). Alcance: alumno → lo propio; apoderado → hijo con
// acceso_academico; administración → por permiso y auditado.

export const listarLibretas = repo.listarLibretas;

export async function boletaDeMatricula(matriculaId: string): Promise<DatosBoleta> {
  const m = await repo.datosMatricula(matriculaId);
  if (!m) throw new NotFoundError('La matrícula no existe');
  const [notas, situacion] = await Promise.all([repo.notasPublicadas(matriculaId), repo.situacionFinal(matriculaId)]);
  const anuales = situacion?.cierre_anual_id ? await repo.resultadosAnuales(situacion.cierre_anual_id) : [];
  const anualDe = new Map(anuales.map((r) => [r.competencia_id, r]));

  const bimestres = new Map<number, string>();
  const areas = new Map<string, Map<string, CompetenciaBoleta>>();
  for (const n of notas) {
    if (n.bimestre == null || !n.competencia_id) continue;
    if (n.publicado_en && !bimestres.has(n.bimestre)) bimestres.set(n.bimestre, n.publicado_en.toISOString());
    const area = n.area ?? 'Otras competencias';
    const comps = areas.get(area) ?? new Map<string, CompetenciaBoleta>();
    const anual = anualDe.get(n.competencia_id);
    const c = comps.get(n.competencia_id) ?? {
      id: n.competencia_id,
      codigo: n.codigo,
      nombre: n.competencia ?? n.codigo,
      bimestres: {},
      anual: anual ? { nivel: anual.nivel_logro, conclusion: anual.conclusion, requiereRecuperacion: anual.requiere_recuperacion } : null,
    };
    c.bimestres[String(n.bimestre)] = { estado: n.estado ?? 'evaluada', nivel: n.nivel_logro, conclusion: n.conclusion };
    comps.set(n.competencia_id, c);
    areas.set(area, comps);
  }
  return {
    matricula: {
      id: m.id,
      anio: m.anio,
      grado: m.grado,
      nivel: m.nivel,
      seccion: m.seccion,
      estado: m.estado,
      estudiante: { id: m.estudiante_id, codigo: m.codigo, codigoSiagie: m.codigo_siagie, nombres: m.nombres, apellidos: m.apellidos },
    },
    bimestres: [...bimestres.entries()].sort((a, b) => a[0] - b[0]).map(([numero, publicadoEn]) => ({ numero, publicadoEn })),
    areas: [...areas.entries()].map(([area, comps]) => ({ area, competencias: [...comps.values()] })),
    situacionFinal: situacion?.situacion
      ? { situacion: situacion.situacion, etapa: situacion.etapa ?? 'ordinario', version: situacion.version ?? 1, aprobadoEn: situacion.aprobado_en ? situacion.aprobado_en.toISOString() : null }
      : null,
  };
}

async function respuestaPortal(estudianteId: string, matriculaId?: string): Promise<RespuestaNotasPortal> {
  const matriculas = await repo.matriculasDeEstudiante(estudianteId);
  const elegida = matriculaId ? matriculas.find((m) => m.id === matriculaId) : matriculas[0];
  if (matriculaId && !elegida) throw new ForbiddenError('La matrícula no pertenece al estudiante');
  return { matriculas, boleta: elegida ? await boletaDeMatricula(elegida.id) : null };
}

export async function notasEstudiante(actor: Actor, matriculaId?: string) {
  const { estudianteId } = await estudianteDelActor(actor);
  return respuestaPortal(estudianteId, matriculaId);
}

export async function notasHijo(actor: Actor, estudianteId: string, matriculaId?: string) {
  await exigirAccesoEstudiante(actor, estudianteId, { portal: 'padre', tipo: 'academico' });
  return respuestaPortal(estudianteId, matriculaId);
}

export async function libretaEstudiante(actor: Actor, matriculaId: string) {
  await exigirAccesoMatricula(actor, matriculaId, { portal: 'estudiante', tipo: 'academico' });
  return generarLibretasPdf([await boletaDeMatricula(matriculaId)]);
}

export async function libretaHijo(actor: Actor, estudianteId: string, matriculaId: string) {
  const m = await exigirAccesoMatricula(actor, matriculaId, { portal: 'padre', tipo: 'academico' });
  if (m.estudiante_id !== estudianteId) throw new ForbiddenError('La matrícula no pertenece al estudiante');
  return generarLibretasPdf([await boletaDeMatricula(matriculaId)]);
}

/** Libreta individual desde administración (auditada). */
export async function libretaAdmin(actor: Actor, matriculaId: string) {
  const boleta = await boletaDeMatricula(matriculaId);
  const pdf = await generarLibretasPdf([boleta]);
  await transaccion(() =>
    registrarBitacora({ actorId: actor.usuarioId, accion: 'emitir_libreta', entidad: 'matriculas', registroId: matriculaId, resultado: 'ok' }),
  );
  return { pdf, boleta };
}

/** Libretas de toda una sección en un solo PDF (auditado). */
export async function libretasSeccion(actor: Actor, seccionId: string) {
  const ids = await repo.matriculasDeSeccion(seccionId);
  if (!ids.length) throw new NotFoundError('La sección no tiene matrículas');
  const boletas = [];
  for (const id of ids) boletas.push(await boletaDeMatricula(id));
  const pdf = await generarLibretasPdf(boletas);
  await transaccion(() =>
    registrarBitacora({ actorId: actor.usuarioId, accion: 'emitir_libretas', entidad: 'secciones', registroId: seccionId, motivo: `${ids.length} libreta(s)`, resultado: 'ok' }),
  );
  return pdf;
}
