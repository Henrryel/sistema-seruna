import { describe, expect, it } from 'vitest';
import * as horarios from '@/server/services/academico/horarios';
import * as portales from '@/server/services/academico/portales';
import { exigirCursoDelDocente } from '@/server/autorizacion/alcance';
import { sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearEstudiante, crearMatriculaActiva, crearUsuario, vincularApoderado } from '@tests/fixtures/base';
import { crearEscenarioAcademico } from '@tests/fixtures/academico';

describe('portales: alcance de cursos y horarios', () => {
  it('el docente solo ve sus cursos y sus bloques', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const u = await crearUsuario({ roles: ['docente'] });
      const e = await crearEscenarioAcademico({ personaDocente: u.personaId });
      const { inicio, fin } = e.anio;
      const fecha = sumarDias(inicio, 14);
      await horarios.crearBloque(admin.actor, { cursoId: e.curso1.cursoId, asignacionId: e.curso1.asignacionId, diaIso: 1, horaInicio: '08:00', horaFin: '09:00', inicio, fin });
      await horarios.crearBloque(admin.actor, { cursoId: e.curso2.cursoId, asignacionId: e.curso2.asignacionId, diaIso: 2, horaInicio: '08:00', horaFin: '09:00', inicio, fin });

      const actor = await actorDe(u);
      expect(actor.portales).toContain('docente');
      const mis = await portales.misCursos(actor, fecha);
      expect(mis.cursos.map((c) => c.curso_id)).toEqual([e.curso1.cursoId]);
      expect(mis.cursos[0]).toMatchObject({ funcion: 'titular', alumnos: 0 });
      // Fuera del año la asignación no está vigente: pasa a "otras".
      const fuera = await portales.misCursos(actor, `${e.anio.anio + 1}-06-01`);
      expect(fuera.cursos).toHaveLength(0);
      expect(fuera.otras.map((o) => o.curso_id)).toContain(e.curso1.cursoId);

      const horario = await portales.horarioDocente(actor, fecha);
      expect(horario.bloques.map((b) => b.curso_id)).toEqual([e.curso1.cursoId]);

      await exigirCursoDelDocente(actor, e.curso1.cursoId);
      await esperarError(exigirCursoDelDocente(actor, e.curso2.cursoId), 'Forbidden');

      // Sin perfil de docente no hay acceso a estas vistas.
      const sinPerfil = await actorDe(await crearUsuario({ roles: ['docente'] }));
      await esperarError(portales.misCursos(sinPerfil, fecha), 'Forbidden', /perfil de docente/);
    }));

  it('estudiante y apoderado ven el horario de la sección de la matrícula vigente', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const e = await crearEscenarioAcademico();
      const { inicio, fin } = e.anio;
      await horarios.crearBloque(admin.actor, { cursoId: e.curso1.cursoId, asignacionId: e.curso1.asignacionId, diaIso: 4, horaInicio: '10:00', horaFin: '11:00', inicio, fin });

      const alumno = await crearUsuario({ roles: ['alumno'] });
      const est = await crearEstudiante({ personaId: alumno.personaId });
      await crearMatriculaActiva({ registradoPor: admin.usuarioId, anio: e.anio, nivel: 'primaria', grado: 3, estudianteId: est.estudianteId, seccionId: e.seccionId });

      const fecha = sumarDias(inicio, 30);
      const propio = await portales.horarioEstudiante(await actorDe(alumno), fecha);
      expect(propio.seccion?.id).toBe(e.seccionId);
      expect(propio.bloques).toHaveLength(1);
      expect(propio.bloques[0]).toMatchObject({ dia_iso: 4, curso_id: e.curso1.cursoId });
      // Fuera del año escolar se muestra la última ubicación (fecha acotada a su vigencia).
      const vacaciones = await portales.horarioEstudiante(await actorDe(alumno), `${e.anio.anio + 1}-02-01`);
      expect(vacaciones.seccion?.id).toBe(e.seccionId);
      expect(vacaciones.fecha).toBe(fin);

      const padre = await crearUsuario({ roles: ['apoderado'] });
      await vincularApoderado({ estudianteId: est.estudianteId, personaId: padre.personaId, verificadoPor: admin.usuarioId, academico: false, economico: false });
      const actorPadre = await actorDe(padre);
      const hijo = await portales.horarioHijo(actorPadre, est.estudianteId, fecha);
      expect(hijo.bloques.map((b) => b.id)).toEqual(propio.bloques.map((b) => b.id));

      const ajeno = await crearEstudiante();
      await esperarError(portales.horarioHijo(actorPadre, ajeno.estudianteId, fecha), 'Forbidden', /vínculo vigente/);
      const sinMatricula = await portales.horarioHijo(
        actorPadre,
        (await (async () => {
          const otro = await crearEstudiante();
          await vincularApoderado({ estudianteId: otro.estudianteId, personaId: padre.personaId, verificadoPor: admin.usuarioId });
          return otro;
        })()).estudianteId,
        fecha,
      );
      expect(sinMatricula).toMatchObject({ seccion: null, bloques: [] });
    }));
});
