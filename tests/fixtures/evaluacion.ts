// Fixtures del módulo de evaluación. Usar SIEMPRE dentro de enPrueba() (todo se revierte).
import React from 'react';
import { db, sql } from '@/server/db';
import type { Actor } from '@/server/auth/actor';
import * as calificaciones from '@/server/services/evaluacion/calificaciones';
import * as cierres from '@/server/services/evaluacion/cierres';
import type { NivelLogro } from '@/esquemas/comunes';
import {
  actorDe,
  crearAdmin,
  crearAnio,
  crearDocente,
  crearEstudiante,
  crearReglaMatricula,
  crearSeccion,
  crearUsuario,
  gradoId,
  sufijo,
} from './base';

// Vitest compila JSX con el runtime clásico (React.createElement) porque tsconfig usa "jsx": "preserve";
// los PDF (src/server/pdf/**) necesitan `React` global en las pruebas. Next usa el runtime automático.
(globalThis as { React?: typeof React }).React ??= React;

export type Escenario = Awaited<ReturnType<typeof crearEscenario>>;

/**
 * Año con 4 bimestres, sección, 2 áreas, 3 competencias (C1 y C2 de Comunicación, C3 de Matemática), plan publicado,
 * 2 cursos (Comunicación: C1+C2 con docente1; Matemática: C3 con docente2) y N alumnos matriculados todo el año.
 * El primer alumno tiene cuenta de usuario (rol alumno).
 */
export async function crearEscenario(opciones: { nivel?: 'primaria' | 'secundaria'; grado?: number; alumnos?: number } = {}) {
  const nivel = opciones.nivel ?? 'primaria';
  const grado = opciones.grado ?? 2;
  const s = sufijo();
  const admin = await crearAdmin();
  const anio = await crearAnio();
  const gid = await gradoId(nivel, grado);
  const seccion = await crearSeccion(anio.anioId, gid);

  const area = async (codigo: string, nombre: string) =>
    (await db().insertInto('areas_curriculares').values({ codigo: `${codigo}-${s}`, nombre }).returning('id').executeTakeFirstOrThrow()).id;
  const areaCom = await area('COM', 'Comunicación');
  const areaMat = await area('MAT', 'Matemática');
  const competencia = async (areaId: string, codigo: string, nombre: string) =>
    (await db().insertInto('competencias').values({ area_id: areaId, codigo: `${codigo}-${s}`, nombre }).returning('id').executeTakeFirstOrThrow()).id;
  const k1 = await competencia(areaCom, 'C1', 'Se comunica oralmente');
  const k2 = await competencia(areaCom, 'C2', 'Lee diversos tipos de textos');
  const k3 = await competencia(areaMat, 'C3', 'Resuelve problemas de cantidad');
  const asignatura = async (areaId: string, codigo: string, nombre: string) =>
    (await db().insertInto('asignaturas').values({ area_id: areaId, codigo: `${codigo}-${s}`, nombre }).returning('id').executeTakeFirstOrThrow()).id;
  const asigCom = await asignatura(areaCom, 'ACOM', 'Comunicación');
  const asigMat = await asignatura(areaMat, 'AMAT', 'Matemática');

  const plan = await db().insertInto('planes_estudio').values({ anio_id: anio.anioId, grado_id: gid, version: 1, publicado_en: sql`now()` }).returning('id').executeTakeFirstOrThrow();
  await db().insertInto('plan_asignaturas').values([{ plan_id: plan.id, asignatura_id: asigCom }, { plan_id: plan.id, asignatura_id: asigMat }]).execute();
  await db().insertInto('plan_competencias').values([k1, k2, k3].map((k) => ({ plan_id: plan.id, competencia_id: k }))).execute();
  await db()
    .insertInto('asignatura_competencias')
    .values([
      { plan_id: plan.id, asignatura_id: asigCom, competencia_id: k1 },
      { plan_id: plan.id, asignatura_id: asigCom, competencia_id: k2 },
      { plan_id: plan.id, asignatura_id: asigMat, competencia_id: k3 },
    ])
    .execute();
  const vigencia = `[${anio.inicio},${anio.fin}]`;
  const sp = await db()
    .insertInto('seccion_planes_estudio')
    .values({ seccion_id: seccion.id, plan_id: plan.id, anio_id: anio.anioId, grado_id: gid, vigencia })
    .returning('id')
    .executeTakeFirstOrThrow();
  const curso = async (asignaturaId: string) =>
    (
      await db()
        .insertInto('cursos_seccion')
        .values({ seccion_plan_id: sp.id, plan_id: plan.id, seccion_id: seccion.id, asignatura_id: asignaturaId })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  const cursoCom = await curso(asigCom);
  const cursoMat = await curso(asigMat);

  const docente = async (cursoId: string) => {
    const u = await crearUsuario({ roles: ['docente'] });
    const d = await crearDocente({ personaId: u.personaId });
    await db().insertInto('asignaciones_docentes').values({ curso_id: cursoId, docente_id: d.docenteId, funcion: 'titular', vigencia }).execute();
    return { ...u, docenteId: d.docenteId, actor: await actorDe(u) };
  };
  const docente1 = await docente(cursoCom);
  const docente2 = await docente(cursoMat);

  const regla = await crearReglaMatricula(anio.anioId, gid);
  const alumnos: { matriculaId: string; estudianteId: string; personaId: string; codigoSiagie: string; usuario?: { usuarioId: string; personaId: string; login: string } }[] = [];
  for (let i = 0; i < (opciones.alumnos ?? 2); i++) {
    const usuario = i === 0 ? await crearUsuario({ roles: ['alumno'] }) : undefined;
    const codigoSiagie = `${Date.now()}${i}${Math.floor(Math.random() * 1000)}`.slice(-14).padStart(14, '0');
    const e = await crearEstudiante({ personaId: usuario?.personaId, codigoSiagie });
    const m = await db()
      .insertInto('matriculas')
      .values({
        estudiante_id: e.estudianteId,
        anio_id: anio.anioId,
        grado_id: gid,
        regla_id: regla.id,
        tipo_ingreso: 'nuevo',
        estado: 'activa',
        confirmada_en: sql`now()`,
        registrado_por: admin.usuarioId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db()
      .insertInto('matricula_secciones')
      .values({ matricula_id: m.id, seccion_id: seccion.id, anio_id: anio.anioId, grado_id: gid, vigencia, registrado_por: admin.usuarioId })
      .execute();
    alumnos.push({ matriculaId: m.id, estudianteId: e.estudianteId, personaId: e.personaId, codigoSiagie, usuario });
  }

  return {
    admin,
    anio,
    gradoId: gid,
    nivel,
    seccionId: seccion.id,
    planId: plan.id,
    areas: { com: areaCom, mat: areaMat },
    competencias: { k1, k2, k3 },
    cursos: { com: cursoCom, mat: cursoMat },
    docente1,
    docente2,
    alumnos,
  };
}

export function bimestre(e: Escenario, numero: 1 | 2 | 3 | 4) {
  const b = e.anio.bimestres[numero - 1];
  if (!b) throw new Error('bimestre inexistente');
  return b;
}

/** Abre el registro (cierre en borrador) de la sección para el bimestre. */
export async function abrirRegistro(e: Escenario, numero: 1 | 2 | 3 | 4) {
  await cierres.abrirRegistro(e.admin.actor, { bimestreId: bimestre(e, numero).id, seccionIds: [e.seccionId] });
  const c = await db().selectFrom('cierres_evaluacion').select('id').where('seccion_id', '=', e.seccionId).where('bimestre_id', '=', bimestre(e, numero).id).executeTakeFirstOrThrow();
  return c.id;
}

/** Califica a todos los alumnos en todas las competencias (por defecto A; conclusión cuando el nivel es B o C). */
export async function calificarTodo(e: Escenario, numero: 1 | 2 | 3 | 4, nivelDe: (alumno: number, competenciaId: string) => NivelLogro = () => 'A', actor?: Actor) {
  const celdas = e.alumnos.flatMap((a, i) =>
    [e.competencias.k1, e.competencias.k2, e.competencias.k3].map((k) => {
      const nivel = nivelDe(i, k);
      return { matriculaId: a.matriculaId, competenciaId: k, estado: 'evaluada' as const, nivelLogro: nivel, conclusion: nivel === 'B' || nivel === 'C' ? 'Necesita reforzar la competencia con acompañamiento.' : null };
    }),
  );
  return calificaciones.guardarAdmin(actor ?? e.admin.actor, { seccionId: e.seccionId, bimestreId: bimestre(e, numero).id, celdas, motivo: null });
}

/** Abre, califica, cierra y publica el bimestre. */
export async function publicarBimestre(e: Escenario, numero: 1 | 2 | 3 | 4, nivelDe?: (alumno: number, competenciaId: string) => NivelLogro) {
  const cierreId = await abrirRegistro(e, numero);
  await calificarTodo(e, numero, nivelDe);
  await cierres.ejecutarAccion(e.admin.actor, cierreId, 'cerrar');
  await cierres.ejecutarAccion(e.admin.actor, cierreId, 'publicar');
  return cierreId;
}
