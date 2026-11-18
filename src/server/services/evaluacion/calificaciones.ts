import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errores';
import { registrarBitacora } from '@/server/repositories/bitacora';
import { docenteDelActor, exigirCursoDelDocente } from '@/server/autorizacion/alcance';
import * as ctx from '@/server/repositories/evaluacion/contexto';
import * as repo from '@/server/repositories/evaluacion/calificaciones';
import type { Actor } from '@/server/auth/actor';
import type { NivelLogro } from '@/esquemas/comunes';
import type {
  Celda,
  CursoDocente,
  FilaRevision,
  GrillaCalificaciones,
  GuardarAdmin,
  GuardarDocente,
  ResultadoGuardado,
} from '@/esquemas/evaluacion/calificaciones';

// Servicio de calificaciones por competencia (docente: solo sus cursos; admin: cualquier sección, auditado).
// Las reglas de la calificación viven en la base (validar_calificacion, registrar_revision_calificacion,
// conservar_calificacion): aquí solo se resuelve el contexto, el ALCANCE y se orquesta la transacción.

type Contexto = {
  seccion: NonNullable<Awaited<ReturnType<typeof ctx.obtenerSeccion>>>;
  bimestre: NonNullable<Awaited<ReturnType<typeof ctx.obtenerBimestre>>>;
  curso: Awaited<ReturnType<typeof ctx.obtenerCurso>> | null;
  planId: string | null;
  competencias: Awaited<ReturnType<typeof ctx.competenciasDePlan>> | Awaited<ReturnType<typeof ctx.competenciasDeCurso>>;
  cierre: Awaited<ReturnType<typeof ctx.cierreDeSeccion>> | null;
  /** Mensaje si la ventana de registro del bimestre está cerrada (solo aplica a docentes). */
  fueraDeVentana: string | null;
};

async function exigirBimestre(bimestreId: string, anioId: string) {
  const b = await ctx.obtenerBimestre(bimestreId);
  if (!b) throw new NotFoundError('El bimestre no existe');
  if (b.anio_id !== anioId) throw new ValidationError('El bimestre no corresponde al año académico de la sección');
  return b;
}

function mensajeVentana(b: { registro_inicio: Date | null; registro_fin: Date | null }): string | null {
  const ahora = Date.now();
  if (b.registro_inicio && ahora < b.registro_inicio.getTime()) return 'El registro de notas de este bimestre aún no inicia';
  if (b.registro_fin && ahora > b.registro_fin.getTime()) return 'El registro de notas de este bimestre ya terminó';
  return null;
}

async function contextoDocente(actor: Actor, cursoId: string, bimestreId: string): Promise<Contexto> {
  // Primero el alcance: un curso ajeno responde Forbidden sin revelar si existe.
  const { docenteId } = await exigirCursoDelDocente(actor, cursoId);
  const curso = await ctx.obtenerCurso(cursoId);
  if (!curso) throw new NotFoundError('El curso no existe');
  const seccion = await ctx.obtenerSeccion(curso.seccion_id);
  if (!seccion) throw new NotFoundError('La sección no existe');
  const bimestre = await exigirBimestre(bimestreId, seccion.anio_id);
  if (!(await repo.docenteAsignadoEnPeriodo(docenteId, cursoId, bimestre.inicio, bimestre.fin))) {
    throw new ForbiddenError('Su asignación al curso no cubre este bimestre');
  }
  return {
    seccion,
    bimestre,
    curso,
    planId: curso.plan_id,
    competencias: await ctx.competenciasDeCurso(curso.plan_id, curso.asignatura_id),
    cierre: (await ctx.cierreDeSeccion(seccion.id, bimestre.id)) ?? null,
    fueraDeVentana: mensajeVentana(bimestre),
  };
}

async function contextoAdmin(seccionId: string, bimestreId: string, cursoId?: string): Promise<Contexto> {
  const seccion = await ctx.obtenerSeccion(seccionId);
  if (!seccion) throw new NotFoundError('La sección no existe');
  const bimestre = await exigirBimestre(bimestreId, seccion.anio_id);
  let curso: Contexto['curso'] = null;
  let planId: string | null;
  let competencias: Contexto['competencias'];
  if (cursoId) {
    curso = (await ctx.obtenerCurso(cursoId)) ?? null;
    if (!curso || curso.seccion_id !== seccion.id) throw new ValidationError('El curso no pertenece a la sección');
    planId = curso.plan_id;
    competencias = await ctx.competenciasDeCurso(curso.plan_id, curso.asignatura_id);
  } else {
    planId = (await ctx.planDeSeccionEn(seccion.id, bimestre.fin)) ?? (await ctx.planDeSeccionEn(seccion.id, bimestre.inicio));
    competencias = planId ? await ctx.competenciasDePlan(planId) : [];
  }
  return { seccion, bimestre, curso, planId, competencias, cierre: (await ctx.cierreDeSeccion(seccion.id, bimestre.id)) ?? null, fueraDeVentana: null };
}

async function armarGrilla(c: Contexto, esDocente: boolean): Promise<GrillaCalificaciones> {
  const alumnos = await ctx.alumnosDeSeccionEnPeriodo(c.seccion.id, c.bimestre.inicio, c.bimestre.fin);
  const notas = await repo.calificacionesDe(
    c.bimestre.id,
    alumnos.map((a) => a.matricula_id),
    c.competencias.map((k) => k.id),
  );
  const porMatricula = new Map<string, GrillaCalificaciones['alumnos'][number]['calificaciones']>();
  for (const n of notas) {
    const m = porMatricula.get(n.matricula_id) ?? {};
    m[n.competencia_id] = {
      id: n.id,
      estado: n.estado,
      nivel_logro: n.nivel_logro as NivelLogro | null,
      conclusion: n.conclusion,
      actualizado_en: n.actualizado_en.toISOString(),
      motivo_cambio: n.motivo_cambio,
    };
    porMatricula.set(n.matricula_id, m);
  }
  let aviso: string | null = null;
  if (!c.cierre) aviso = 'El registro de notas de este bimestre aún no se ha abierto para la sección.';
  else if (c.cierre.estado !== 'borrador') aviso = `El bimestre está ${c.cierre.estado}: para rectificar notas debe reabrirse.`;
  else if (esDocente && c.fueraDeVentana) aviso = `${c.fueraDeVentana}.`;
  else if (!c.competencias.length) aviso = 'No hay competencias configuradas para este curso en el plan de estudios.';
  const cursos = esDocente ? [] : await ctx.cursosDeSeccion(c.seccion.id);
  return {
    contexto: {
      seccionId: c.seccion.id,
      seccion: c.seccion.nombre,
      grado: c.seccion.grado,
      nivel: c.seccion.nivel,
      nivelCodigo: c.seccion.nivel_codigo as 'primaria' | 'secundaria',
      anioId: c.seccion.anio_id,
      planId: c.planId,
      cursoId: c.curso?.id ?? null,
      asignatura: c.curso?.asignatura ?? null,
      bimestre: { id: c.bimestre.id, numero: c.bimestre.numero, inicio: c.bimestre.inicio, fin: c.bimestre.fin },
      cierre: c.cierre ? { id: c.cierre.id, estado: c.cierre.estado } : null,
      editable: Boolean(c.cierre && c.cierre.estado === 'borrador' && !(esDocente && c.fueraDeVentana) && c.competencias.length),
      aviso,
    },
    cursos: cursos.map((x) => ({ id: x.id, asignatura: x.asignatura })),
    competencias: c.competencias.map((k) => ({ id: k.id, codigo: k.codigo, nombre: k.nombre, area: k.area })),
    alumnos: alumnos.map((a) => ({
      matriculaId: a.matricula_id,
      estudianteId: a.estudiante_id,
      codigo: a.codigo,
      nombres: a.nombres,
      apellidos: a.apellidos,
      enNomina: Boolean(a.en_nomina),
      calificaciones: porMatricula.get(a.matricula_id) ?? {},
    })),
  };
}

const igual = (a: string | null | undefined, b: string | null | undefined) => (a ?? null) === (b ?? null);

async function guardar(actor: Actor, c: Contexto, celdas: Celda[], motivo: string | null, esDocente: boolean): Promise<ResultadoGuardado> {
  const cierre = c.cierre;
  if (!cierre) throw new ConflictError('El registro de notas de este bimestre aún no está abierto para la sección');
  if (!c.planId) throw new ValidationError('La sección no tiene un plan de estudios vigente en el bimestre');
  if (esDocente) {
    if (c.fueraDeVentana) throw new ConflictError(c.fueraDeVentana);
    const propias = new Set(c.competencias.map((k) => k.id));
    if (celdas.some((x) => !propias.has(x.competenciaId))) {
      throw new ForbiddenError('Solo puede calificar las competencias de su curso');
    }
  }
  const existentes = await repo.calificacionesDe(
    c.bimestre.id,
    [...new Set(celdas.map((x) => x.matriculaId))],
    [...new Set(celdas.map((x) => x.competenciaId))],
  );
  const mapa = new Map(existentes.map((e) => [`${e.matricula_id}:${e.competencia_id}`, e]));
  const resultado: ResultadoGuardado = { insertadas: 0, rectificadas: 0, sinCambios: 0 };
  return transaccion(async () => {
    for (const celda of celdas) {
      const previa = mapa.get(`${celda.matriculaId}:${celda.competenciaId}`);
      if (!previa) {
        await repo.insertarCalificacion({
          celda,
          bimestreId: c.bimestre.id,
          planId: c.planId as string,
          cierreId: cierre.id,
          anioId: cierre.anio_id,
          gradoId: cierre.grado_id,
          autorId: actor.usuarioId,
        });
        resultado.insertadas++;
      } else if (igual(previa.estado, celda.estado) && igual(previa.nivel_logro, celda.nivelLogro) && igual(previa.conclusion, celda.conclusion)) {
        resultado.sinCambios++;
      } else {
        // La base exige motivo y cierre en borrador; registra la revisión anterior/nueva.
        await repo.rectificarCalificacion(previa.id, celda, actor.usuarioId, motivo);
        resultado.rectificadas++;
      }
    }
    if (resultado.insertadas || resultado.rectificadas) {
      await registrarBitacora({
        actorId: actor.usuarioId,
        accion: resultado.rectificadas ? 'rectificar' : 'calificar',
        entidad: 'calificaciones_competencia',
        registroId: cierre.id,
        motivo: [`${resultado.insertadas} nueva(s), ${resultado.rectificadas} rectificada(s)`, c.curso ? `curso ${c.curso.id}` : null, motivo]
          .filter(Boolean)
          .join(' · '),
        resultado: 'ok',
      });
    }
    return resultado;
  });
}

async function historial(c: Contexto): Promise<FilaRevision[]> {
  const alumnos = await ctx.alumnosDeSeccionEnPeriodo(c.seccion.id, c.bimestre.inicio, c.bimestre.fin);
  const filas = await repo.revisiones({
    bimestreId: c.bimestre.id,
    matriculaIds: alumnos.map((a) => a.matricula_id),
    competenciaIds: c.competencias.map((k) => k.id),
  });
  const parte = (j: unknown) => {
    const o = (j ?? {}) as Record<string, unknown>;
    return { estado: String(o.estado ?? ''), nivel_logro: (o.nivel_logro as string | null) ?? null, conclusion: (o.conclusion as string | null) ?? null };
  };
  return filas.map((f) => ({
    id: f.id,
    calificacion_id: f.calificacion_id,
    matricula_id: f.matricula_id,
    alumno: f.alumno,
    competencia: f.competencia,
    anterior: parte(f.anterior),
    nueva: parte(f.nueva),
    autor: f.autor,
    motivo: f.motivo,
    registrado_en: f.registrado_en.toISOString(),
  }));
}

// ── Docente ───────────────────────────────────────────────────────────────

export async function cursosDocente(actor: Actor): Promise<CursoDocente[]> {
  const { docenteId } = await docenteDelActor(actor);
  const filas = await repo.cursosCalificablesDocente(docenteId);
  return filas.map((f) => ({
    cursoId: f.curso_id,
    asignatura: f.asignatura,
    seccionId: f.seccion_id,
    seccion: f.seccion,
    grado: f.grado,
    nivel: f.nivel,
    anioId: f.anio_id,
    anio: f.anio,
  }));
}

export async function grillaDocente(actor: Actor, q: { cursoId: string; bimestreId: string }) {
  return armarGrilla(await contextoDocente(actor, q.cursoId, q.bimestreId), true);
}

export async function guardarDocente(actor: Actor, d: GuardarDocente) {
  return guardar(actor, await contextoDocente(actor, d.cursoId, d.bimestreId), d.celdas, d.motivo, true);
}

export async function historialDocente(actor: Actor, q: { cursoId: string; bimestreId: string }) {
  return historial(await contextoDocente(actor, q.cursoId, q.bimestreId));
}

// ── Administración (cualquier sección; auditado) ─────────────────────────────

export async function grillaAdmin(q: { seccionId: string; bimestreId: string; cursoId?: string }) {
  return armarGrilla(await contextoAdmin(q.seccionId, q.bimestreId, q.cursoId), false);
}

export async function guardarAdmin(actor: Actor, d: GuardarAdmin) {
  return guardar(actor, await contextoAdmin(d.seccionId, d.bimestreId, d.cursoId), d.celdas, d.motivo, false);
}

export async function historialAdmin(q: { seccionId: string; bimestreId: string; cursoId?: string }) {
  return historial(await contextoAdmin(q.seccionId, q.bimestreId, q.cursoId));
}
