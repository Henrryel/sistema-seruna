import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as reglas from '@/server/services/evaluacion/reglas';
import * as anual from '@/server/services/evaluacion/cierre-anual';
import * as recuperacion from '@/server/services/evaluacion/recuperacion';
import * as merito from '@/server/services/evaluacion/merito';
import * as cierres from '@/server/services/evaluacion/cierres';
import * as calificaciones from '@/server/services/evaluacion/calificaciones';
import { CRITERIOS_EJEMPLO } from '@/esquemas/evaluacion/criterios';
import { sumarDias } from '@/lib/formato';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { bimestre, crearEscenario, publicarBimestre, type Escenario } from '@tests/fixtures/evaluacion';

async function reglaAprobada(e: Escenario) {
  const r = await reglas.crearRegla(e.admin.actor, {
    anioId: e.anio.anioId,
    gradoId: e.gradoId,
    referenciaNormativa: 'RVM 094-2020-MINEDU y modificatorias (a verificar)',
    criterios: CRITERIOS_EJEMPLO,
  });
  await reglas.aprobarRegla(e.admin.actor, r.id);
  return r;
}

async function cierreDe(matriculaId: string, version = 1) {
  return (await db().selectFrom('cierres_anuales').select('id').where('matricula_id', '=', matriculaId).where('version', '=', version).executeTakeFirstOrThrow()).id;
}

describe('reglas, cierre anual y recuperación', () => {
  it('versiona y aprueba reglas, genera y aprueba cierres anuales y completa la recuperación', () =>
    enPrueba(async () => {
      const e = await crearEscenario();
      const [a0, a1] = e.alumnos;
      if (!a0 || !a1) throw new Error('faltan alumnos');

      // Regla: borrador editable; aprobada inmutable (la base exige versionar).
      const regla = await reglaAprobada(e);
      expect(regla.version).toBe(1);
      await esperarError(reglas.actualizarRegla(e.admin.actor, regla.id, { referenciaNormativa: 'otra', criterios: CRITERIOS_EJEMPLO }), 'Conflict', /nueva versión/);
      await esperarError(reglas.eliminarRegla(e.admin.actor, regla.id), 'Conflict');
      const v2 = await reglas.crearRegla(e.admin.actor, { anioId: e.anio.anioId, gradoId: e.gradoId, referenciaNormativa: 'borrador', criterios: CRITERIOS_EJEMPLO });
      expect(v2.version).toBe(2);
      await reglas.eliminarRegla(e.admin.actor, v2.id);

      // Sin bimestres publicados no se puede aprobar.
      for (const n of [1, 2, 3] as const) await publicarBimestre(e, n);
      // 4.º bimestre: el segundo alumno termina con C en Matemática (C3).
      const c4 = await publicarBimestre(e, 4, (i, k) => (i === 1 && k === e.competencias.k3 ? 'C' : 'A'));

      const gen = await anual.generarBorradores(e.admin.actor, { anioId: e.anio.anioId, seccionId: e.seccionId });
      expect(gen).toEqual({ creados: 2, omitidos: [] });
      const listado = await anual.listarCierresAnuales({ seccionId: e.seccionId }, { limite: 10, desplazamiento: 0 });
      expect(listado.total).toBe(2);

      const id0 = await cierreDe(a0.matriculaId);
      const d0 = await anual.detalleCierreAnual(id0);
      expect(d0.fecha_corte).toBe(bimestre(e, 4).fin);
      expect(d0.resultados_detalle).toHaveLength(3);
      expect(d0.resultados_detalle.every((r) => r.fuente === 'calificacion' && r.bimestre === 4)).toBe(true);
      expect(d0.sugerencia).toMatchObject({ situacion: 'promovido' });
      expect(d0.situacion).toBe('promovido');

      // Si cambian los logros publicados, la base exige actualizar el borrador.
      await cierres.ejecutarAccion(e.admin.actor, c4, 'reabrir', 'Rectificación de nota');
      await calificaciones.guardarAdmin(e.admin.actor, {
        seccionId: e.seccionId,
        bimestreId: bimestre(e, 4).id,
        celdas: [{ matriculaId: a0.matriculaId, competenciaId: e.competencias.k1, estado: 'evaluada', nivelLogro: 'AD', conclusion: null }],
        motivo: 'Error de registro',
      });
      await cierres.ejecutarAccion(e.admin.actor, c4, 'cerrar');
      await cierres.ejecutarAccion(e.admin.actor, c4, 'publicar');
      await esperarError(anual.aprobarCierreAnual(e.admin.actor, id0, { situacion: 'promovido', sustento: 'Acta de evaluación' }), 'Validation', /últimos logros/);
      await anual.actualizarBorrador(e.admin.actor, id0);
      await anual.aprobarCierreAnual(e.admin.actor, id0, { situacion: 'promovido', sustento: 'Acta de evaluación' });
      const final0 = await db().selectFrom('situaciones_finales').select(['situacion', 'version']).where('matricula_id', '=', a0.matriculaId).executeTakeFirstOrThrow();
      expect(final0).toEqual({ situacion: 'promovido', version: 1 });
      // Aprobado = inmutable.
      await esperarError(anual.descartarBorrador(e.admin.actor, id0), 'Conflict');

      // Segundo alumno: sugerencia de recuperación con C3 pendiente.
      const id1 = await cierreDe(a1.matriculaId);
      const d1 = await anual.detalleCierreAnual(id1);
      expect(d1.sugerencia).toMatchObject({ situacion: 'recuperacion', pendientes: [e.competencias.k3] });
      const lote = await anual.aprobarLote(e.admin.actor, { ids: [id1], sustento: 'Acta de evaluación' });
      expect(lote[0]).toMatchObject({ ok: true });
      const pendientes = await recuperacion.listarPendientes({ seccionId: e.seccionId }, { limite: 10, desplazamiento: 0 });
      expect(pendientes.total).toBe(1);
      const pendiente = pendientes.filas[0];
      if (!pendiente) throw new Error('sin pendiente');
      expect(pendiente.nivel_original).toBe('C');

      // Recuperación: antes del corte la base la rechaza; luego borrador → aprobada.
      await esperarError(
        recuperacion.registrarEvaluacion(e.admin.actor, { resultadoOrigenId: pendiente.resultado_id, tipo: 'recuperacion', fecha: bimestre(e, 4).inicio, nivelLogro: 'B', conclusion: null }),
        'Validation',
        /pendiente en un cierre aprobado/,
      );
      const ev = await recuperacion.registrarEvaluacion(e.admin.actor, {
        resultadoOrigenId: pendiente.resultado_id,
        tipo: 'recuperacion',
        fecha: sumarDias(d1.fecha_corte, 45),
        nivelLogro: 'B',
        conclusion: 'Logró avances en la resolución de problemas.',
      });
      expect(ev.intento).toBe(1);
      await recuperacion.aprobarEvaluacion(e.admin.actor, ev.id);
      await esperarError(
        recuperacion.editarEvaluacion(e.admin.actor, ev.id, { tipo: 'recuperacion', fecha: sumarDias(d1.fecha_corte, 45), nivelLogro: 'A', conclusion: null }),
        'Conflict',
      );

      // Nueva versión de recuperación: toma la evaluación aprobada y sugiere promoción.
      const v = await anual.nuevaVersion(e.admin.actor, id1, { etapa: 'recuperacion', motivo: 'Resultado del programa de recuperación' });
      expect(v.situacionSugerida).toBe('promovido');
      const dv = await anual.detalleCierreAnual(v.id);
      expect(dv.resultados_detalle.find((r) => r.competencia_id === e.competencias.k3)).toMatchObject({ fuente: 'recuperacion', nivel_logro: 'B', requiere_recuperacion: false });
      await anual.aprobarCierreAnual(e.admin.actor, v.id, { situacion: 'promovido', sustento: 'Acta de recuperación' });
      const final1 = await db().selectFrom('situaciones_finales').select(['situacion', 'etapa', 'version']).where('matricula_id', '=', a1.matriculaId).executeTakeFirstOrThrow();
      expect(final1).toEqual({ situacion: 'promovido', etapa: 'recuperacion', version: 2 });

      // Rectificación del primer alumno (versión 2) y solo sobre el último cierre.
      const rect = await anual.nuevaVersion(e.admin.actor, id0, { etapa: 'rectificacion', motivo: 'Corrección de acta' });
      await esperarError(anual.nuevaVersion(e.admin.actor, id0, { etapa: 'rectificacion', motivo: 'otra' }), 'Conflict');
      await anual.aprobarCierreAnual(e.admin.actor, rect.id, { situacion: 'promovido', sustento: 'Acta rectificada' });
      const tray = (await anual.detalleCierreAnual(rect.id)).trayectoria;
      expect(tray.map((t) => [t.version, t.etapa, t.estado])).toEqual([
        [1, 'ordinario', 'aprobado'],
        [2, 'rectificacion', 'aprobado'],
      ]);
    }));

  it('mérito: registra el listado oficial de SIAGIE con puestos consecutivos y lo publica (solo Secundaria)', () =>
    enPrueba(async () => {
      const e = await crearEscenario({ nivel: 'secundaria', grado: 3 });
      const [a0, a1] = e.alumnos;
      if (!a0 || !a1) throw new Error('faltan alumnos');
      await reglaAprobada(e);
      for (const n of [1, 2, 3, 4] as const) await publicarBimestre(e, n, () => 'AD');
      await anual.generarBorradores(e.admin.actor, { anioId: e.anio.anioId });
      for (const m of [a0, a1]) await anual.aprobarCierreAnual(e.admin.actor, await cierreDe(m.matriculaId), { situacion: 'promovido', sustento: 'Acta' });

      const archivo = { contenido: Buffer.from('%PDF-1.4 listado SIAGIE'), nombreOriginal: 'merito-siagie.pdf', tipoMime: 'application/pdf' };
      await esperarError(
        merito.registrarPublicacion(e.admin.actor, { anioId: e.anio.anioId, gradoId: e.gradoId, alcance: 'secundaria_completa', referenciaSiagie: 'R-1' }, archivo),
        'Validation',
        /quinto grado/,
      );
      const pub = await merito.registrarPublicacion(e.admin.actor, { anioId: e.anio.anioId, gradoId: e.gradoId, alcance: 'grado', referenciaSiagie: 'SIAGIE-2026-001' }, archivo);
      expect(pub.version).toBe(1);
      const detalle = await merito.detallePublicacion(pub.id);
      expect(detalle.candidatos).toHaveLength(2);

      await merito.registrarPuestos(e.admin.actor, pub.id, [{ matriculaId: a0.matriculaId, puesto: 2, calificativo: '9.5', sustentoDesempate: null }]);
      await esperarError(merito.publicar(e.admin.actor, pub.id), 'Conflict', /consecutivos/);
      await merito.registrarPuestos(e.admin.actor, pub.id, [
        { matriculaId: a1.matriculaId, puesto: 2, calificativo: '9.2', sustentoDesempate: null },
        { matriculaId: a0.matriculaId, puesto: 1, calificativo: '9.5', sustentoDesempate: null },
      ]);
      await esperarError(
        merito.registrarPuestos(e.admin.actor, pub.id, [{ matriculaId: a0.matriculaId, puesto: 1, calificativo: '11', sustentoDesempate: null }]),
        'Validation',
      );
      await merito.publicar(e.admin.actor, pub.id);
      await esperarError(merito.quitarPuesto(e.admin.actor, pub.id, a0.matriculaId), 'Conflict', /inmutable/);
      const publicado = await merito.meritoPublicado({ anioId: e.anio.anioId });
      expect(publicado.map((p) => [p.puesto, p.matricula_id])).toEqual([
        [1, a0.matriculaId],
        [2, a1.matriculaId],
      ]);
    }));

  it('mérito: en Primaria la base lo rechaza', () =>
    enPrueba(async () => {
      const e = await crearEscenario({ alumnos: 1 });
      await reglaAprobada(e);
      await esperarError(
        merito.registrarPublicacion(
          e.admin.actor,
          { anioId: e.anio.anioId, gradoId: e.gradoId, alcance: 'grado', referenciaSiagie: 'R' },
          { contenido: Buffer.from('%PDF-1.4'), nombreOriginal: 'x.pdf', tipoMime: 'application/pdf' },
        ),
        'Validation',
        /Secundaria/,
      );
    }));
});
