import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hoyLima, sumarDias } from '@/lib/formato';
import { db, sql } from '@/server/db';
import { bloquesPermitidos, consultarDashboard } from '@/server/services/dashboard/admin';
import { inicioDocente, inicioEstudiante, inicioPadre } from '@/server/services/dashboard/inicio';
import { enPrueba, esperarError } from '@tests/helpers/db';
import {
  actorDe,
  crearAdmin,
  crearAnio,
  crearDocente,
  crearEstudiante,
  crearMatriculaActiva,
  crearUsuario,
  vincularApoderado,
} from '@tests/fixtures/base';

/** Año (número aleatorio) cuyo rango incluye HOY, con un único bimestre que lo cubre. */
async function anioQueIncluyeHoy() {
  const hoy = hoyLima();
  const inicio = sumarDias(hoy, -30);
  const fin = sumarDias(hoy, 30);
  const numero = 2100 + randomInt(100);
  const a = await db().insertInto('anios_academicos').values({ anio: numero, inicio, fin, estado: 'abierto' }).returning(['id']).executeTakeFirstOrThrow();
  const b = await db().insertInto('bimestres').values({ anio_id: a.id, numero: 1, inicio, fin }).returning(['id']).executeTakeFirstOrThrow();
  return { anioId: a.id, anio: numero, inicio, fin, bimestres: [{ id: b.id, numero: 1, inicio, fin }] };
}

describe('dashboard institucional (indicadores_dashboard)', () => {
  it('devuelve los indicadores del año con todos los bloques para el administrador', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const m = await crearMatriculaActiva({ registradoPor: admin.usuarioId });
      const b1 = m.anio.bimestres[0];
      const r = await consultarDashboard(admin.actor, { anioId: m.anio.anioId, desde: m.anio.inicio, hasta: m.anio.fin, bimestreId: b1?.id });
      expect(r.bloques).toEqual(['matricula', 'asistencia', 'pagos', 'notas', 'planilla']);
      expect(r.matricula?.activas).toBe(1);
      expect(r.matricula?.cupo).toBe(30);
      expect(r.matricula?.vacantes_totales).toBe(29);
      expect(r.pagos?.cobrado_neto_aplicado).toBe(0);
      expect(r.pagos?.recaudacion).toEqual([]);
      expect(r.asistencia?.alumnos.esperadas).toBe(0);
      expect(r.notas?.avance?.esperadas).toBe(0);
      expect(r.notas?.distribucion.map((d) => d.nivel)).toEqual(['AD', 'A', 'B', 'C']);
      expect(r.planilla?.liquidaciones).toBeGreaterThanOrEqual(0);
    }));

  it('la base rechaza un rango inválido y un bimestre de otro año', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const a = await crearAnio();
      const otro = await crearAnio({ anio: a.anio === 2199 ? 2100 : a.anio + 1 });
      await esperarError(consultarDashboard(admin.actor, { anioId: a.anioId, desde: a.fin, hasta: a.inicio }), 'Validation', /rango de fechas/);
      await esperarError(
        consultarDashboard(admin.actor, { anioId: a.anioId, desde: a.inicio, hasta: a.fin, bimestreId: otro.bimestres[0]?.id }),
        'Validation',
        /bimestre no pertenece/,
      );
    }));

  it('solo muestra los bloques permitidos y rechaza a quien no tiene ninguno', () =>
    enPrueba(async () => {
      expect(bloquesPermitidos({ permisos: ['reportes.tesoreria'] })).toEqual(['pagos']);
      expect(bloquesPermitidos({ permisos: ['planilla.pagar', 'reportes.academico'] })).toEqual(['notas', 'planilla']);
      const docente = await crearUsuario({ roles: ['docente'] });
      const a = await crearAnio();
      await esperarError(consultarDashboard(await actorDe(docente), { anioId: a.anioId, desde: a.inicio, hasta: a.fin }), 'Forbidden');
    }));
});

describe('inicio de portales (alcance)', () => {
  it('estudiante: su matrícula, asistencia del mes y deuda', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario({ roles: ['alumno'] });
      const e = await crearEstudiante({ personaId: u.personaId });
      const anio = await anioQueIncluyeHoy();
      const m = await crearMatriculaActiva({ registradoPor: admin.usuarioId, estudianteId: e.estudianteId, anio });
      const r = await inicioEstudiante(await actorDe(u));
      expect(r.estudiante.id).toBe(e.estudianteId);
      expect(r.matricula?.id).toBe(m.matriculaId);
      expect(r.matricula?.seccion).toBe('A');
      expect(r.logros).toEqual([]);
      expect(r.asistencia?.esperadas).toBe(0);
      expect(r.deuda).toMatchObject({ total: '0', vencido: '0', cuotasPendientes: 0, proximoVencimiento: null });
    }));

  it('padre: resumen del hijo según acceso académico/económico; un estudiante ajeno se rechaza', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const padre = await crearUsuario({ roles: ['apoderado'] });
      const m = await crearMatriculaActiva({ registradoPor: admin.usuarioId });
      await vincularApoderado({ estudianteId: m.estudianteId, personaId: padre.personaId, verificadoPor: admin.usuarioId, academico: true, economico: false });
      const actor = await actorDe(padre);
      const r = await inicioPadre(actor, m.estudianteId);
      expect(r.accesoAcademico).toBe(true);
      expect(r.accesoEconomico).toBe(false);
      expect(r.deuda).toBeNull();
      expect(r.logros).toEqual([]);
      const ajeno = await crearEstudiante();
      await esperarError(inicioPadre(actor, ajeno.estudianteId), 'Forbidden');
    }));

  it('docente: clases del día desde el horario y calificaciones pendientes de sus cierres en borrador', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario({ roles: ['docente'] });
      const { docenteId } = await crearDocente({ personaId: u.personaId });
      const hoy = hoyLima();
      const anio = await anioQueIncluyeHoy();
      const m = await crearMatriculaActiva({ registradoPor: admin.usuarioId, anio });
      const sufijoCodigo = `${docenteId}-${Date.now().toString(36)}`;
      const area = await db().insertInto('areas_curriculares').values({ codigo: `AR-${sufijoCodigo}`, nombre: 'Comunicación' }).returning('id').executeTakeFirstOrThrow();
      const comp = await db()
        .insertInto('competencias')
        .values({ codigo: `C-${sufijoCodigo}`, nombre: 'Lee diversos tipos de textos', area_id: area.id })
        .returning('id')
        .executeTakeFirstOrThrow();
      const asig = await db().insertInto('asignaturas').values({ codigo: `COM-${sufijoCodigo}`, nombre: 'Comunicación', area_id: area.id }).returning('id').executeTakeFirstOrThrow();
      const plan = await db().insertInto('planes_estudio').values({ anio_id: anio.anioId, grado_id: m.gradoId, version: 1, publicado_en: sql`now()` }).returning('id').executeTakeFirstOrThrow();
      await db().insertInto('plan_asignaturas').values({ plan_id: plan.id, asignatura_id: asig.id }).execute();
      await db().insertInto('plan_competencias').values({ plan_id: plan.id, competencia_id: comp.id }).execute();
      await db().insertInto('asignatura_competencias').values({ plan_id: plan.id, asignatura_id: asig.id, competencia_id: comp.id }).execute();
      const sp = await db()
        .insertInto('seccion_planes_estudio')
        .values({ seccion_id: m.seccionId, plan_id: plan.id, anio_id: anio.anioId, grado_id: m.gradoId, vigencia: `[${anio.inicio},${anio.fin}]` })
        .returning('id')
        .executeTakeFirstOrThrow();
      const curso = await db()
        .insertInto('cursos_seccion')
        .values({ seccion_plan_id: sp.id, plan_id: plan.id, seccion_id: m.seccionId, asignatura_id: asig.id })
        .returning('id')
        .executeTakeFirstOrThrow();
      const asignacion = await db()
        .insertInto('asignaciones_docentes')
        .values({ curso_id: curso.id, docente_id: docenteId, funcion: 'titular', vigencia: `[${anio.inicio},${anio.fin}]` })
        .returning('id')
        .executeTakeFirstOrThrow();
      const diaIso = ((new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
      await db()
        .insertInto('bloques_horario')
        .values({
          curso_id: curso.id,
          asignacion_id: asignacion.id,
          seccion_id: m.seccionId,
          docente_id: docenteId,
          dia_iso: diaIso,
          hora_inicio: '08:00',
          hora_fin: '09:30',
          vigencia: `[${anio.inicio},${anio.fin}]`,
        })
        .execute();
      const b1 = anio.bimestres[0];
      await db()
        .insertInto('cierres_evaluacion')
        .values({ seccion_id: m.seccionId, bimestre_id: b1?.id ?? '0', anio_id: anio.anioId, grado_id: m.gradoId, responsable_id: admin.usuarioId })
        .execute();

      const r = await inicioDocente(await actorDe(u));
      expect(r.fecha).toBe(hoy);
      expect(r.origenClases).toBe('horario');
      expect(r.clases).toHaveLength(1);
      expect(r.clases[0]).toMatchObject({ origen: 'horario', asignatura: 'Comunicación', hora_inicio: '08:00', hora_fin: '09:30' });
      expect(r.pendientes).toHaveLength(1);
      expect(r.pendientes[0]).toMatchObject({ curso_id: curso.id, bimestre: 1, esperadas: 1, pendientes: 1 });
    }));
});
