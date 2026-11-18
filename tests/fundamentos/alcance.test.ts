import { describe, expect, it } from 'vitest';
import { db, sql } from '@/server/db';
import { exigirAccesoEstudiante, hijosDelApoderado, cursosDelDocente, exigirCursoDelDocente } from '@/server/autorizacion/alcance';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearDocente, crearEstudiante, crearMatriculaActiva, crearUsuario, vincularApoderado } from '@tests/fixtures/base';

describe('alcance de datos', () => {
  it('alumno: solo su propio registro', () =>
    enPrueba(async () => {
      const u = await crearUsuario({ roles: ['alumno'] });
      const propio = await crearEstudiante({ personaId: u.personaId });
      const otro = await crearEstudiante();
      const actor = await actorDe(u);
      expect(actor.portales).toContain('estudiante');
      await exigirAccesoEstudiante(actor, propio.estudianteId, { portal: 'estudiante', tipo: 'academico' });
      await esperarError(exigirAccesoEstudiante(actor, otro.estudianteId, { portal: 'estudiante', tipo: 'academico' }), 'Forbidden');
    }));

  it('apoderado: solo hijos con vínculo vigente y según acceso académico/económico', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const padre = await crearUsuario({ roles: ['apoderado'] });
      const hijo = await crearEstudiante();
      const ajeno = await crearEstudiante();
      const exHijo = await crearEstudiante();
      await vincularApoderado({ estudianteId: hijo.estudianteId, personaId: padre.personaId, verificadoPor: admin.usuarioId, academico: true, economico: false });
      await vincularApoderado({ estudianteId: exHijo.estudianteId, personaId: padre.personaId, verificadoPor: admin.usuarioId, vigencia: '[2001-01-01,2002-01-01)' });
      const actor = await actorDe(padre);
      expect(actor.portales).toContain('padre');
      const hijos = await hijosDelApoderado(actor);
      expect(hijos.map((h) => h.estudianteId)).toEqual([hijo.estudianteId]);
      await exigirAccesoEstudiante(actor, hijo.estudianteId, { portal: 'padre', tipo: 'academico' });
      await esperarError(exigirAccesoEstudiante(actor, hijo.estudianteId, { portal: 'padre', tipo: 'economico' }), 'Forbidden', /pagos/);
      await esperarError(exigirAccesoEstudiante(actor, ajeno.estudianteId, { portal: 'padre', tipo: 'basico' }), 'Forbidden');
      await esperarError(exigirAccesoEstudiante(actor, exHijo.estudianteId, { portal: 'padre', tipo: 'basico' }), 'Forbidden');
    }));

  it('docente: solo sus cursos asignados', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario({ roles: ['docente'] });
      const { docenteId } = await crearDocente({ personaId: u.personaId });
      const m = await crearMatriculaActiva({ registradoPor: admin.usuarioId });
      const area = await db().insertInto('areas_curriculares').values({ codigo: `AR-${docenteId}`, nombre: 'Matemática' }).returning('id').executeTakeFirstOrThrow();
      const asig = await db().insertInto('asignaturas').values({ codigo: `MAT-${docenteId}`, nombre: 'Matemática', area_id: area.id }).returning('id').executeTakeFirstOrThrow();
      const plan = await db().insertInto('planes_estudio').values({ anio_id: m.anio.anioId, grado_id: m.gradoId, version: 1, publicado_en: sql`now()` }).returning('id').executeTakeFirstOrThrow();
      await db().insertInto('plan_asignaturas').values({ plan_id: plan.id, asignatura_id: asig.id }).execute();
      const sp = await db()
        .insertInto('seccion_planes_estudio')
        .values({ seccion_id: m.seccionId, plan_id: plan.id, anio_id: m.anio.anioId, grado_id: m.gradoId, vigencia: `[${m.anio.inicio},${m.anio.fin}]` })
        .returning('id')
        .executeTakeFirstOrThrow();
      const curso = await db()
        .insertInto('cursos_seccion')
        .values({ seccion_plan_id: sp.id, plan_id: plan.id, seccion_id: m.seccionId, asignatura_id: asig.id })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db().insertInto('asignaciones_docentes').values({ curso_id: curso.id, docente_id: docenteId, funcion: 'titular', vigencia: `[${m.anio.inicio},${m.anio.fin}]` }).execute();
      const actor = await actorDe(u);
      expect(actor.portales).toContain('docente');
      const cursos = await cursosDelDocente(actor, m.anio.bimestres[0]?.inicio);
      expect(cursos.map((c) => c.curso_id)).toEqual([curso.id]);
      await exigirCursoDelDocente(actor, curso.id);
      const otro = await crearUsuario({ roles: ['docente'] });
      await crearDocente({ personaId: otro.personaId });
      await esperarError(exigirCursoDelDocente(await actorDe(otro), curso.id), 'Forbidden');
    }));
});
