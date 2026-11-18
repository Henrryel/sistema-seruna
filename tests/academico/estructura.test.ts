import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { esquemaGenerarLectivos } from '@/esquemas/academico/calendario';
import { esquemaSeccion } from '@/esquemas/academico/secciones';
import { esquemaAsignacion } from '@/esquemas/academico/asignaciones';
import * as calendario from '@/server/services/academico/calendario';
import * as secciones from '@/server/services/academico/secciones';
import * as asignaciones from '@/server/services/academico/asignaciones';
import { sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearAdmin, crearAnio, crearDocente, crearMatriculaActiva, gradoId } from '@tests/fixtures/base';
import { crearEscenarioAcademico } from '@tests/fixtures/academico';

describe('calendario escolar', () => {
  it('genera lunes a viernes como lectivos sin pisar días existentes y dentro del año', () =>
    enPrueba(async () => {
      const { actor } = await crearAdmin();
      const anio = await crearAnio();
      const desde = anio.inicio;
      const hasta = sumarDias(desde, 27); // 4 semanas: 20 días hábiles
      const habil = [0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(desde, i)).find((f) => ![0, 6].includes(new Date(`${f}T12:00:00Z`).getUTCDay())) ?? desde;
      await calendario.crearDia(actor, { anioId: anio.anioId, fecha: habil, tipo: 'no_lectivo', descripcion: 'Jornada de planificación' });
      await esperarError(calendario.crearDia(actor, { anioId: anio.anioId, fecha: habil, tipo: 'lectivo', descripcion: null }), 'Conflict', /ya está registrado/);

      const r = await calendario.generarLectivos(actor, esquemaGenerarLectivos.parse({ anioId: anio.anioId, desde, hasta, descripcion: 'Clases' }));
      expect(r.creados).toBe(19);
      const dia = await db().selectFrom('calendario_escolar').select(['tipo', 'descripcion']).where('anio_id', '=', anio.anioId).where('fecha', '=', habil).executeTakeFirstOrThrow();
      expect(dia).toEqual({ tipo: 'no_lectivo', descripcion: 'Jornada de planificación' });
      expect(await calendario.resumen(anio.anioId)).toEqual({ lectivo: 19, feriado: 0, no_lectivo: 1 });
      expect((await calendario.generarLectivos(actor, esquemaGenerarLectivos.parse({ anioId: anio.anioId, desde, hasta }))).creados).toBe(0);

      const listado = await calendario.listarDias({ anioId: anio.anioId, tipo: 'lectivo' }, { limite: 5, desplazamiento: 0 });
      expect(listado.total).toBe(19);
      expect(listado.filas.every((f) => f.dia_semana >= 1 && f.dia_semana <= 5)).toBe(true);

      await calendario.actualizarDia(actor, anio.anioId, habil, { tipo: 'feriado', descripcion: 'Feriado regional' });
      await calendario.eliminarDia(actor, anio.anioId, habil);
      await esperarError(calendario.eliminarDia(actor, anio.anioId, habil), 'NotFound');
      await esperarError(
        calendario.generarLectivos(actor, esquemaGenerarLectivos.parse({ anioId: anio.anioId, desde: `${anio.anio - 1}-12-01`, hasta })),
        'Validation',
        /dentro del año escolar/,
      );
    }));
});

describe('secciones, ocupación y asignaciones docentes', () => {
  it('normaliza el nombre, traduce los CHECK de cupo y calcula la ocupación', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const anio = await crearAnio();
      const grado = await gradoId('primaria', 1);
      const s = await secciones.crearSeccion(admin.actor, esquemaSeccion.parse({ anioId: anio.anioId, gradoId: grado, nombre: ' c ', turno: 'Mañana', cupo: 25, reserva: 2 }));
      const guardada = await secciones.obtenerSeccion(s.id);
      expect(guardada.nombre).toBe('C');
      await esperarError(
        secciones.crearSeccion(admin.actor, esquemaSeccion.parse({ anioId: anio.anioId, gradoId: grado, nombre: 'C', turno: 'Tarde', cupo: 20 })),
        'Conflict',
        /Ya existe una sección/,
      );
      await esperarError(
        secciones.actualizarSeccion(admin.actor, s.id, esquemaSeccion.parse({ anioId: anio.anioId, gradoId: grado, nombre: 'C', turno: 'Mañana', cupo: 10, reserva: 11 })),
        'Validation',
        /reserva/,
      );
      await crearMatriculaActiva({ registradoPor: admin.usuarioId, anio, nivel: 'primaria', grado: 1, seccionId: s.id });
      const lista = await secciones.listarSecciones({ anioId: anio.anioId }, { limite: 10, desplazamiento: 0 });
      expect(lista.filas).toHaveLength(1);
      expect(lista.filas[0]).toMatchObject({ id: s.id, ocupadas: 1, cupo: 25, nombre: 'C' });
      const grados = await secciones.listarGrados(anio.anioId);
      expect(grados.find((g) => g.id === grado)).toMatchObject({ secciones: 1, cupo_total: 25, ocupadas: 1 });
    }));

  it('asigna docentes dentro de la vigencia del plan de la sección', () =>
    enPrueba(async () => {
      const admin = await crearAdmin();
      const e = await crearEscenarioAcademico();
      const { inicio, fin } = e.anio;
      const reemplazo = await crearDocente();
      const r = await asignaciones.crearAsignacion(
        admin.actor,
        esquemaAsignacion.parse({ cursoId: e.curso1.cursoId, docenteId: reemplazo.docenteId, funcion: 'reemplazo', inicio: sumarDias(inicio, 10), fin: sumarDias(inicio, 40) }),
      );
      // Mismo docente y curso con vigencia superpuesta: EXCLUDE.
      await esperarError(
        asignaciones.crearAsignacion(admin.actor, esquemaAsignacion.parse({ cursoId: e.curso1.cursoId, docenteId: reemplazo.docenteId, funcion: 'apoyo', inicio: sumarDias(inicio, 30), fin })),
        'Conflict',
        /ya está asignado/,
      );
      // Fuera del plan de la sección: trigger validar_vigencia_horario.
      await esperarError(
        asignaciones.crearAsignacion(admin.actor, esquemaAsignacion.parse({ cursoId: e.curso2.cursoId, docenteId: reemplazo.docenteId, funcion: 'apoyo', inicio, fin: `${e.anio.anio + 1}-01-31` })),
        'Validation',
        /plan de la sección/,
      );
      const lista = await asignaciones.listarAsignaciones({ cursoId: e.curso1.cursoId }, { limite: 10, desplazamiento: 0 });
      expect(lista.filas.map((f) => f.funcion).sort()).toEqual(['reemplazo', 'titular']);
      expect(lista.filas.find((f) => f.id === r.id)).toMatchObject({ inicio: sumarDias(inicio, 10), fin: sumarDias(inicio, 40) });
      await asignaciones.eliminarAsignacion(admin.actor, r.id);
      const cursos = await asignaciones.listarCursos({ seccionId: e.seccionId, sinDocente: 'true' }, { limite: 10, desplazamiento: 0 });
      expect(cursos.total).toBe(0);
    }));
});
