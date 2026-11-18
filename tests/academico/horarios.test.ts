import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { esquemaAula } from '@/esquemas/academico/secciones';
import { esquemaGenerarLectivos } from '@/esquemas/academico/calendario';
import * as horarios from '@/server/services/academico/horarios';
import * as calendario from '@/server/services/academico/calendario';
import { crearAula } from '@/server/services/academico/secciones';
import { sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearAdmin, crearDocente, crearSeccion, sufijo } from '@tests/fixtures/base';
import { aplicarPlan, asignarDocente, crearEscenarioAcademico } from '@tests/fixtures/academico';

/** Primer lunes en o después de la fecha. */
function primerLunes(fecha: string) {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 = domingo, 1 = lunes
  return sumarDias(fecha, (1 - dia + 7) % 7);
}

const bloque = (cursoId: string, asignacionId: string, diaIso: number, horaInicio: string, horaFin: string, inicio: string, fin: string, aulaId?: string) => ({
  cursoId,
  asignacionId,
  aulaId,
  diaIso,
  horaInicio,
  horaFin,
  inicio,
  fin,
});

describe('horarios', () => {
  it('rechaza (por la base) choques de sección, docente y aula y vigencias fuera de la asignación', () =>
    enPrueba(async () => {
      const { actor } = await crearAdmin();
      const e = await crearEscenarioAcademico();
      const { inicio, fin } = e.anio;
      const aula = await crearAula(actor, esquemaAula.parse({ codigo: `AU-${sufijo()}`, nombre: 'Aula 101', capacidad: 30 }));

      const b1 = await horarios.crearBloque(actor, bloque(e.curso1.cursoId, e.curso1.asignacionId, 1, '08:00', '09:30', inicio, fin, aula.id));
      // Misma sección, mismo día y franja superpuesta (otro docente): EXCLUDE de sección.
      await esperarError(horarios.crearBloque(actor, bloque(e.curso2.cursoId, e.curso2.asignacionId, 1, '09:00', '10:00', inicio, fin)), 'Conflict', /sección ya tiene otra clase/);
      // Contiguo sí se permite (franjas [inicio, fin)).
      await horarios.crearBloque(actor, bloque(e.curso2.cursoId, e.curso2.asignacionId, 1, '09:30', '10:30', inicio, fin));

      // Otra sección del mismo grado con el mismo plan.
      const otra = await crearSeccion(e.anio.anioId, e.gradoId, { nombre: 'B' });
      const { cursos } = await aplicarPlan({ planId: e.planId, seccionId: otra.id, anioId: e.anio.anioId, gradoId: e.gradoId, inicio, fin });
      const [cursoB1, cursoB2] = cursos;
      if (!cursoB1 || !cursoB2) throw new Error('El plan debe tener dos cursos');
      const asigB1 = await asignarDocente(cursoB1.cursoId, e.curso1.docenteId, inicio, fin);
      // Mismo docente a la misma hora en otra sección: EXCLUDE de docente.
      await esperarError(horarios.crearBloque(actor, bloque(cursoB1.cursoId, asigB1, 1, '08:30', '09:00', inicio, fin)), 'Conflict', /docente ya tiene otra clase/);
      // Misma aula a la misma hora: EXCLUDE de aula.
      const otroDocente = await crearDocente();
      const asigB2 = await asignarDocente(cursoB2.cursoId, otroDocente.docenteId, inicio, fin);
      await esperarError(horarios.crearBloque(actor, bloque(cursoB2.cursoId, asigB2, 1, '08:00', '08:45', inicio, fin, aula.id)), 'Conflict', /aula ya está ocupada/);

      // Vigencia del bloque fuera de la asignación docente (trigger validar_vigencia_horario).
      const apoyo = await asignarDocente(cursoB2.cursoId, (await crearDocente()).docenteId, inicio, sumarDias(inicio, 20), 'apoyo');
      await esperarError(horarios.crearBloque(actor, bloque(cursoB2.cursoId, apoyo, 2, '08:00', '09:00', inicio, fin)), 'Validation', /asignación docente/);
      // Asignación de otro curso: la FK compuesta lo rechaza.
      await esperarError(horarios.crearBloque(actor, bloque(cursoB2.cursoId, asigB1, 2, '08:00', '09:00', inicio, fin)), 'Validation', /no corresponde al curso/);
      // Franja vacía: CHECK de la base (las horas invertidas también se traducen).
      await esperarError(horarios.crearBloque(actor, bloque(e.curso1.cursoId, e.curso1.asignacionId, 3, '09:00', '09:00', inicio, fin)), 'Validation', /hora de fin/);
      await esperarError(horarios.crearBloque(actor, bloque(e.curso1.cursoId, e.curso1.asignacionId, 3, '10:00', '09:00', inicio, fin)), 'Validation', /posterior al inicio/);

      const grilla = await horarios.horarioDeSeccion(e.seccionId, sumarDias(inicio, 10));
      expect(grilla.bloques.map((b) => [b.dia_iso, b.hora_inicio.slice(0, 5)])).toEqual([
        [1, '08:00'],
        [1, '09:30'],
      ]);
      expect(grilla.bloques[0]).toMatchObject({ id: b1.id, aula_id: aula.id, aula: 'Aula 101', inicio, fin });
      expect(grilla.bloques[0]?.docente).toBeTruthy();

      await horarios.actualizarBloque(actor, b1.id, { aulaId: undefined, diaIso: 2, horaInicio: '08:00', horaFin: '09:00', inicio, fin });
      const movido = await db().selectFrom('bloques_horario').select(['dia_iso', 'aula_id']).where('id', '=', b1.id).executeTakeFirstOrThrow();
      expect(movido).toEqual({ dia_iso: 2, aula_id: null });
    }));

  it('genera sesiones desde los bloques omitiendo días no lectivos y sin duplicar', () =>
    enPrueba(async () => {
      const { actor } = await crearAdmin();
      const e = await crearEscenarioAcademico();
      const { inicio, fin } = e.anio;
      const lunes = primerLunes(inicio);
      const hasta = sumarDias(lunes, 13);
      await horarios.crearBloque(actor, bloque(e.curso1.cursoId, e.curso1.asignacionId, 1, '08:00', '09:00', inicio, fin));
      await horarios.crearBloque(actor, bloque(e.curso2.cursoId, e.curso2.asignacionId, 3, '10:00', '11:00', inicio, fin));

      // Calendario: el segundo lunes es feriado y se genera el resto sin pisarlo.
      await calendario.crearDia(actor, { anioId: e.anio.anioId, fecha: sumarDias(lunes, 7), tipo: 'feriado', descripcion: 'Feriado de prueba' });
      const gen = await calendario.generarLectivos(actor, esquemaGenerarLectivos.parse({ anioId: e.anio.anioId, desde: lunes, hasta }));
      expect(gen.creados).toBe(9);

      const r1 = await horarios.generarSesiones(actor, { seccionId: e.seccionId, desde: lunes, hasta });
      expect(r1).toMatchObject({ creadas: 3, existentes: 0, diasSinClase: 1, omitidas: [] });
      const r2 = await horarios.generarSesiones(actor, { seccionId: e.seccionId, desde: lunes, hasta });
      expect(r2).toMatchObject({ creadas: 0, existentes: 3 });

      const lista = await horarios.listarSesiones({ seccionId: e.seccionId }, { limite: 20, desplazamiento: 0 });
      expect(lista.total).toBe(3);
      expect(lista.filas.map((s) => s.fecha)).toEqual([lunes, sumarDias(lunes, 2), sumarDias(lunes, 9)]);
      const primera = lista.filas[0];
      if (!primera) throw new Error('sin sesiones');

      // Sesión manual que se cruza con otra de la sección: EXCLUDE de sesiones (no canceladas).
      await esperarError(
        horarios.crearSesion(actor, { asignacionId: e.curso2.asignacionId, fecha: lunes, horaInicio: '08:30', horaFin: '09:30' }),
        'Conflict',
        /sección ya tiene otra sesión/,
      );
      // Fuera de la vigencia del plan: trigger.
      await esperarError(
        horarios.crearSesion(actor, { asignacionId: e.curso2.asignacionId, fecha: `${e.anio.anio + 1}-04-01`, horaInicio: '08:00', horaFin: '09:00' }),
        'Validation',
        /plan de la sección/,
      );

      // Cancelada libera la franja; realizada es final.
      await horarios.cambiarEstadoSesion(actor, primera.id, 'cancelada');
      const manual = await horarios.crearSesion(actor, { asignacionId: e.curso2.asignacionId, fecha: lunes, horaInicio: '08:30', horaFin: '09:30' });
      await horarios.cambiarEstadoSesion(actor, manual.id, 'realizada');
      await esperarError(horarios.cambiarEstadoSesion(actor, manual.id, 'cancelada'), 'Conflict', /realizada/);
      // Reprogramar la cancelada choca ahora con la manual: lo rechaza la base.
      await esperarError(horarios.cambiarEstadoSesion(actor, primera.id, 'programada'), 'Conflict', /Choque de horario/);

      const auditoria = await db().selectFrom('bitacora').select('accion').where('actor_id', '=', actor.usuarioId).where('entidad', '=', 'sesiones_clase').execute();
      expect(auditoria.map((a) => a.accion)).toEqual(expect.arrayContaining(['generar_sesiones', 'crear', 'marcar_cancelada', 'marcar_realizada']));
    }));
});
