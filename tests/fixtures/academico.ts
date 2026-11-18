// Fixtures del módulo de estructura académica. Usar SIEMPRE dentro de enPrueba() (todo se revierte).
import { db, sql } from '@/server/db';
import { crearAnio, crearDocente, crearSeccion, gradoId, sufijo } from './base';

/** Área con asignaturas y competencias (códigos únicos con sufijo aleatorio). */
export async function crearCurriculo(opciones: { asignaturas?: number; competencias?: number } = {}) {
  const s = sufijo().toUpperCase();
  const area = await db().insertInto('areas_curriculares').values({ codigo: `AR-${s}`, nombre: `Área ${s}` }).returning('id').executeTakeFirstOrThrow();
  const asignaturas: string[] = [];
  for (let i = 1; i <= (opciones.asignaturas ?? 2); i++) {
    const a = await db()
      .insertInto('asignaturas')
      .values({ codigo: `AS${i}-${s}`, nombre: `Asignatura ${i} ${s}`, area_id: area.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    asignaturas.push(a.id);
  }
  const competencias: string[] = [];
  for (let i = 1; i <= (opciones.competencias ?? 2); i++) {
    const c = await db()
      .insertInto('competencias')
      .values({ codigo: `C${i}-${s}`, nombre: `Competencia ${i} ${s}`, area_id: area.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    competencias.push(c.id);
  }
  return { areaId: area.id, asignaturas, competencias };
}

/** Plan publicado con asignaturas, competencias y mapeo 1:1 (asignatura i → competencia i). */
export async function crearPlanPublicado(anioId: string, grado: string, curriculo: Awaited<ReturnType<typeof crearCurriculo>>) {
  const plan = await db()
    .insertInto('planes_estudio')
    .values({ anio_id: anioId, grado_id: grado, version: 1, publicado_en: sql`now()` })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const a of curriculo.asignaturas) await db().insertInto('plan_asignaturas').values({ plan_id: plan.id, asignatura_id: a }).execute();
  for (const c of curriculo.competencias) await db().insertInto('plan_competencias').values({ plan_id: plan.id, competencia_id: c }).execute();
  for (const [i, a] of curriculo.asignaturas.entries()) {
    const c = curriculo.competencias[i];
    if (c) await db().insertInto('asignatura_competencias').values({ plan_id: plan.id, asignatura_id: a, competencia_id: c }).execute();
  }
  return plan.id;
}

/** Aplica el plan a la sección durante todo el año y crea sus cursos. */
export async function aplicarPlan(opciones: { planId: string; seccionId: string; anioId: string; gradoId: string; inicio: string; fin: string }) {
  const sp = await db()
    .insertInto('seccion_planes_estudio')
    .values({
      seccion_id: opciones.seccionId,
      plan_id: opciones.planId,
      anio_id: opciones.anioId,
      grado_id: opciones.gradoId,
      vigencia: `[${opciones.inicio},${opciones.fin}]`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const asignaturas = await db().selectFrom('plan_asignaturas').select('asignatura_id').where('plan_id', '=', opciones.planId).orderBy('asignatura_id').execute();
  const cursos: { cursoId: string; asignaturaId: string }[] = [];
  for (const a of asignaturas) {
    const c = await db()
      .insertInto('cursos_seccion')
      .values({ seccion_plan_id: sp.id, plan_id: opciones.planId, seccion_id: opciones.seccionId, asignatura_id: a.asignatura_id })
      .returning('id')
      .executeTakeFirstOrThrow();
    cursos.push({ cursoId: c.id, asignaturaId: a.asignatura_id });
  }
  return { seccionPlanId: sp.id, cursos };
}

export async function asignarDocente(cursoId: string, docenteId: string, inicio: string, fin: string, funcion = 'titular') {
  const a = await db()
    .insertInto('asignaciones_docentes')
    .values({ curso_id: cursoId, docente_id: docenteId, funcion, vigencia: `[${inicio},${fin}]` })
    .returning('id')
    .executeTakeFirstOrThrow();
  return a.id;
}

/**
 * Escenario completo: año con bimestres, sección de 3.º de primaria con plan publicado aplicado, dos cursos
 * y un docente titular distinto en cada curso.
 */
export async function crearEscenarioAcademico(opciones: { personaDocente?: string; nombreSeccion?: string } = {}) {
  const anio = await crearAnio();
  const grado = await gradoId('primaria', 3);
  const seccion = await crearSeccion(anio.anioId, grado, { nombre: opciones.nombreSeccion ?? 'A' });
  const curriculo = await crearCurriculo();
  const planId = await crearPlanPublicado(anio.anioId, grado, curriculo);
  const { seccionPlanId, cursos } = await aplicarPlan({ planId, seccionId: seccion.id, anioId: anio.anioId, gradoId: grado, inicio: anio.inicio, fin: anio.fin });
  const docente1 = await crearDocente(opciones.personaDocente ? { personaId: opciones.personaDocente } : {});
  const docente2 = await crearDocente();
  const [curso1, curso2] = cursos as [{ cursoId: string; asignaturaId: string }, { cursoId: string; asignaturaId: string }];
  const asignacion1 = await asignarDocente(curso1.cursoId, docente1.docenteId, anio.inicio, anio.fin);
  const asignacion2 = await asignarDocente(curso2.cursoId, docente2.docenteId, anio.inicio, anio.fin);
  return {
    anio,
    gradoId: grado,
    seccionId: seccion.id,
    planId,
    seccionPlanId,
    curriculo,
    curso1: { ...curso1, asignacionId: asignacion1, docenteId: docente1.docenteId, personaId: docente1.personaId },
    curso2: { ...curso2, asignacionId: asignacion2, docenteId: docente2.docenteId, personaId: docente2.personaId },
  };
}
