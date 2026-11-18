import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as servicio from '@/server/services/evaluacion/calificaciones';
import { esquemaGuardarDocente } from '@/esquemas/evaluacion/calificaciones';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { abrirRegistro, bimestre, crearEscenario } from '@tests/fixtures/evaluacion';

describe('calificaciones por competencia', () => {
  it('el docente califica solo las competencias de su curso; otro docente recibe Forbidden', () =>
    enPrueba(async () => {
      const e = await crearEscenario();
      const b1 = bimestre(e, 1);
      // Sin registro abierto no se puede guardar.
      const [a1, a2] = e.alumnos;
      if (!a1 || !a2) throw new Error('faltan alumnos');
      const celda = { matriculaId: a1.matriculaId, competenciaId: e.competencias.k1, estado: 'evaluada' as const, nivelLogro: 'A' as const, conclusion: null };
      await esperarError(servicio.guardarDocente(e.docente1.actor, { cursoId: e.cursos.com, bimestreId: b1.id, celdas: [celda], motivo: null }), 'Conflict', /no está abierto/);
      await abrirRegistro(e, 1);

      const cursos = await servicio.cursosDocente(e.docente1.actor);
      expect(cursos.map((c) => c.cursoId)).toEqual([e.cursos.com]);

      const grilla = await servicio.grillaDocente(e.docente1.actor, { cursoId: e.cursos.com, bimestreId: b1.id });
      expect(grilla.competencias.map((k) => k.id).sort()).toEqual([e.competencias.k1, e.competencias.k2].sort());
      expect(grilla.alumnos).toHaveLength(2);
      expect(grilla.contexto.editable).toBe(true);

      const r = await servicio.guardarDocente(e.docente1.actor, {
        cursoId: e.cursos.com,
        bimestreId: b1.id,
        celdas: [celda, { matriculaId: a2.matriculaId, competenciaId: e.competencias.k2, estado: 'no_desarrollada', nivelLogro: null, conclusion: null }],
        motivo: null,
      });
      expect(r).toEqual({ insertadas: 2, rectificadas: 0, sinCambios: 0 });

      // Competencia de otro curso (Matemática) → Forbidden.
      await esperarError(
        servicio.guardarDocente(e.docente1.actor, {
          cursoId: e.cursos.com,
          bimestreId: b1.id,
          celdas: [{ matriculaId: a1.matriculaId, competenciaId: e.competencias.k3, estado: 'evaluada', nivelLogro: 'B', conclusion: 'x' }],
          motivo: null,
        }),
        'Forbidden',
      );
      // Otro docente no puede ver ni calificar el curso ajeno.
      await esperarError(servicio.grillaDocente(e.docente2.actor, { cursoId: e.cursos.com, bimestreId: b1.id }), 'Forbidden');
      await esperarError(
        servicio.guardarDocente(e.docente2.actor, { cursoId: e.cursos.com, bimestreId: b1.id, celdas: [celda], motivo: null }),
        'Forbidden',
      );
      // Y sí califica su propia competencia.
      const r2 = await servicio.guardarDocente(e.docente2.actor, {
        cursoId: e.cursos.mat,
        bimestreId: b1.id,
        celdas: [{ matriculaId: a1.matriculaId, competenciaId: e.competencias.k3, estado: 'evaluada', nivelLogro: 'AD', conclusion: null }],
        motivo: null,
      });
      expect(r2.insertadas).toBe(1);
    }));

  it('rectificar sin motivo es rechazado por la base; con motivo queda en el historial', () =>
    enPrueba(async () => {
      const e = await crearEscenario({ alumnos: 1 });
      const b1 = bimestre(e, 1);
      await abrirRegistro(e, 1);
      const a1 = e.alumnos[0];
      if (!a1) throw new Error('falta alumno');
      const base = { cursoId: e.cursos.com, bimestreId: b1.id };
      await servicio.guardarDocente(e.docente1.actor, {
        ...base,
        celdas: [{ matriculaId: a1.matriculaId, competenciaId: e.competencias.k1, estado: 'evaluada', nivelLogro: 'B', conclusion: 'Avanza en la expresión oral.' }],
        motivo: null,
      });
      const cambio = { matriculaId: a1.matriculaId, competenciaId: e.competencias.k1, estado: 'evaluada' as const, nivelLogro: 'A' as const, conclusion: null };
      await esperarError(servicio.guardarDocente(e.docente1.actor, { ...base, celdas: [cambio], motivo: null }), 'Validation', /motivo de la rectificación/);
      // Reenviar lo mismo no es un cambio.
      const igual = await servicio.guardarDocente(e.docente1.actor, {
        ...base,
        celdas: [{ ...cambio, nivelLogro: 'B', conclusion: 'Avanza en la expresión oral.' }],
        motivo: null,
      });
      expect(igual).toEqual({ insertadas: 0, rectificadas: 0, sinCambios: 1 });

      const ok = await servicio.guardarDocente(e.docente1.actor, { ...base, celdas: [cambio], motivo: 'Error de digitación' });
      expect(ok.rectificadas).toBe(1);
      // Una segunda rectificación sin motivo no hereda el anterior.
      await esperarError(
        servicio.guardarDocente(e.docente1.actor, { ...base, celdas: [{ ...cambio, nivelLogro: 'AD' }], motivo: null }),
        'Validation',
        /motivo/,
      );

      const historial = await servicio.historialDocente(e.docente1.actor, base);
      expect(historial).toHaveLength(1);
      expect(historial[0]?.motivo).toBe('Error de digitación');
      expect(historial[0]?.anterior.nivel_logro).toBe('B');
      expect(historial[0]?.nueva.nivel_logro).toBe('A');
      const fila = await db().selectFrom('calificaciones_competencia').select(['nivel_logro', 'conclusion']).where('matricula_id', '=', a1.matriculaId).executeTakeFirstOrThrow();
      expect(fila).toEqual({ nivel_logro: 'A', conclusion: null });
    }));

  it('esquema: nivel obligatorio si está evaluada; no desarrollada sin conclusión', () => {
    const r = esquemaGuardarDocente.safeParse({ cursoId: '1', bimestreId: '1', celdas: [{ matriculaId: '1', competenciaId: '1', estado: 'evaluada' }] });
    expect(r.success).toBe(false);
    const ok = esquemaGuardarDocente.parse({
      cursoId: '1',
      bimestreId: '1',
      celdas: [{ matriculaId: '1', competenciaId: '1', estado: 'no_desarrollada', nivelLogro: 'C', conclusion: 'x' }],
    });
    expect(ok.celdas[0]).toMatchObject({ nivelLogro: null, conclusion: null });
  });
});
