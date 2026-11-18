import { describe, expect, it } from 'vitest';
import { db, sql } from '@/server/db';
import * as registro from '@/server/services/asistencia/registro';
import { hoyLima, sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearDocente, crearUsuario, sufijo } from '@tests/fixtures/base';
import { crearEscenarioAlumnos } from '@tests/fixtures/asistencia';

/** Curso de la sección asignado al docente y una sesión de clase en `fecha`. */
async function crearSesion(e: { anioId: string; gradoId: string; seccionId: string; inicio: string; fin: string; docenteId: string; fecha: string }) {
  const s = sufijo();
  const area = await db().insertInto('areas_curriculares').values({ codigo: `AR-${s}`, nombre: 'Comunicación' }).returning('id').executeTakeFirstOrThrow();
  const asig = await db().insertInto('asignaturas').values({ codigo: `COM-${s}`, nombre: 'Comunicación', area_id: area.id }).returning('id').executeTakeFirstOrThrow();
  const plan = await db().insertInto('planes_estudio').values({ anio_id: e.anioId, grado_id: e.gradoId, version: 1, publicado_en: sql`now()` }).returning('id').executeTakeFirstOrThrow();
  await db().insertInto('plan_asignaturas').values({ plan_id: plan.id, asignatura_id: asig.id }).execute();
  const sp = await db()
    .insertInto('seccion_planes_estudio')
    .values({ seccion_id: e.seccionId, plan_id: plan.id, anio_id: e.anioId, grado_id: e.gradoId, vigencia: `[${e.inicio},${e.fin}]` })
    .returning('id')
    .executeTakeFirstOrThrow();
  const curso = await db()
    .insertInto('cursos_seccion')
    .values({ seccion_plan_id: sp.id, plan_id: plan.id, seccion_id: e.seccionId, asignatura_id: asig.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const asignacion = await db()
    .insertInto('asignaciones_docentes')
    .values({ curso_id: curso.id, docente_id: e.docenteId, funcion: 'titular', vigencia: `[${e.inicio},${e.fin}]` })
    .returning('id')
    .executeTakeFirstOrThrow();
  return db()
    .insertInto('sesiones_clase')
    .values({ curso_id: curso.id, seccion_id: e.seccionId, asignacion_id: asignacion.id, docente_id: e.docenteId, fecha: e.fecha, hora_inicio: '08:00', hora_fin: '09:30' })
    .returning('id')
    .executeTakeFirstOrThrow();
}

describe('asistencia por sesión de clase', () => {
  it('el docente toma asistencia de SU sesión; otro docente no; el alumno la ve por curso', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const ayer = sumarDias(hoyLima(), -1);
      const esc = await crearEscenarioAlumnos({ registradoPor: admin.usuarioId, alumnos: 2, fecha: ayer, entrada: '07:45', salida: '13:00' });
      const [a1, a2] = esc.alumnos as [(typeof esc.alumnos)[0], (typeof esc.alumnos)[0]];
      const u = await crearUsuario({ roles: ['docente'] });
      const { docenteId } = await crearDocente({ personaId: u.personaId });
      const sesion = await crearSesion({ anioId: esc.anio.anioId, gradoId: esc.gradoId, seccionId: esc.seccionId, inicio: esc.anio.inicio, fin: esc.anio.fin, docenteId, fecha: ayer });
      const docente = await actorDe(u);

      const propias = await registro.listarSesiones(docente, { fecha: ayer }, 'docente');
      expect(propias.map((s) => s.id)).toEqual([sesion.id]);
      expect(propias[0]).toMatchObject({ curso: 'Comunicación', registrados: 0 });
      expect((await registro.seccionesDelDocente(docente, ayer)).map((s) => s.id)).toEqual([esc.seccionId]);

      const nomina = await registro.listarAsistenciaSesion(docente, { sesionId: sesion.id }, null, 'docente');
      expect(nomina.total).toBe(2);
      const r = await registro.registrarSesion(
        docente,
        sesion.id,
        { motivo: 'Asistencia tomada en clase', registros: [{ matriculaId: a1.matriculaId, estado: 'ausente' }, { matriculaId: a2.matriculaId, estado: 'presente' }] },
        'docente',
      );
      expect(r).toEqual({ guardados: 2, sinCambios: 0, errores: [] });
      const filas = await db().selectFrom('asistencia_estudiantes').select(['matricula_id', 'estado', 'sesion_id']).where('sesion_id', '=', sesion.id).execute();
      expect(filas).toHaveLength(2);
      // La asistencia por sesión no altera la diaria.
      const diaria = await registro.listarDiariaSeccion(docente, { seccionId: esc.seccionId, fecha: ayer }, null, 'docente');
      expect(diaria.filas.every((f) => f.estado === 'pendiente')).toBe(true);

      const otro = await crearUsuario({ roles: ['docente'] });
      await crearDocente({ personaId: otro.personaId });
      const ajeno = await actorDe(otro);
      await esperarError(registro.obtenerSesion(ajeno, sesion.id, 'docente'), 'Forbidden');
      await esperarError(registro.registrarSesion(ajeno, sesion.id, { motivo: 'x', registros: [{ matriculaId: a1.matriculaId, estado: 'presente' }] }, 'docente'), 'Forbidden');

      const alumno = await actorDe(await crearUsuario({ roles: ['alumno'], personaId: a1.personaId }));
      const resumen = await registro.resumenPropioAlumno(alumno, {});
      expect(resumen.sesiones).toHaveLength(1);
      expect(resumen.sesiones[0]).toMatchObject({ curso: 'Comunicación', estado: 'ausente', justificable: true });
    }));
});
