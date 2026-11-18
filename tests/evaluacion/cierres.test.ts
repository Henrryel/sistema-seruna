import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import * as cierres from '@/server/services/evaluacion/cierres';
import * as calificaciones from '@/server/services/evaluacion/calificaciones';
import * as notas from '@/server/services/evaluacion/notas';
import { actorDe, crearUsuario, vincularApoderado } from '@tests/fixtures/base';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { abrirRegistro, bimestre, calificarTodo, crearEscenario } from '@tests/fixtures/evaluacion';

describe('cierres de bimestre y publicación', () => {
  it('abre el registro en masa, rechaza cerrar con C sin conclusión, publica y reabre con auditoría', () =>
    enPrueba(async () => {
      const e = await crearEscenario();
      const b1 = bimestre(e, 1);
      const r = await cierres.abrirRegistro(e.admin.actor, { bimestreId: b1.id, seccionIds: [e.seccionId] });
      expect(r.creados).toBe(1);
      const cierreId = (await db().selectFrom('cierres_evaluacion').select('id').where('seccion_id', '=', e.seccionId).where('bimestre_id', '=', b1.id).executeTakeFirstOrThrow()).id;

      // Sin notas: la base no permite cerrar.
      await esperarError(cierres.ejecutarAccion(e.admin.actor, cierreId, 'cerrar'), 'Validation', /pendientes|faltan/i);

      // Todas las notas, pero una C sin conclusión descriptiva.
      await calificarTodo(e, 1);
      const [a1] = e.alumnos;
      if (!a1) throw new Error('falta alumno');
      await calificaciones.guardarAdmin(e.admin.actor, {
        seccionId: e.seccionId,
        bimestreId: b1.id,
        celdas: [{ matriculaId: a1.matriculaId, competenciaId: e.competencias.k3, estado: 'evaluada', nivelLogro: 'C', conclusion: null }],
        motivo: 'Corrección del nivel',
      });
      const avance = await cierres.detalleCierre(cierreId);
      expect(avance.avance).toBe(100);
      expect(avance.sin_conclusion).toBe(1);
      expect(avance.faltantes.map((f) => f.motivo)).toEqual(['sin_conclusion']);
      await esperarError(cierres.ejecutarAccion(e.admin.actor, cierreId, 'cerrar'), 'Validation', /conclusiones descriptivas/);

      // Con la conclusión ya se puede cerrar y publicar (publicar sin cerrar no).
      await esperarError(cierres.ejecutarAccion(e.admin.actor, cierreId, 'publicar'), 'Conflict', /Cierre el bimestre/);
      await calificaciones.guardarAdmin(e.admin.actor, {
        seccionId: e.seccionId,
        bimestreId: b1.id,
        celdas: [{ matriculaId: a1.matriculaId, competenciaId: e.competencias.k3, estado: 'evaluada', nivelLogro: 'C', conclusion: 'Requiere apoyo en problemas de cantidad.' }],
        motivo: 'Agrega conclusión',
      });
      await cierres.ejecutarAccion(e.admin.actor, cierreId, 'cerrar');
      // Cerrado: el docente ya no puede rectificar.
      await esperarError(
        calificaciones.guardarDocente(e.docente1.actor, {
          cursoId: e.cursos.com,
          bimestreId: b1.id,
          celdas: [{ matriculaId: a1.matriculaId, competenciaId: e.competencias.k1, estado: 'evaluada', nivelLogro: 'AD', conclusion: null }],
          motivo: 'cambio',
        }),
        'Conflict',
        /Reabra el cierre/,
      );
      const lote = await cierres.ejecutarLote(e.admin.actor, { ids: [cierreId], accion: 'publicar' });
      expect(lote).toEqual([{ id: cierreId, ok: true, mensaje: 'Listo' }]);
      const publicado = await db().selectFrom('cierres_evaluacion').select(['estado', 'cerrado_en', 'publicado_en']).where('id', '=', cierreId).executeTakeFirstOrThrow();
      expect(publicado.estado).toBe('publicado');
      expect(publicado.publicado_en).not.toBeNull();

      // Reabrir: vuelve a borrador limpiando fechas y queda auditado.
      await cierres.ejecutarAccion(e.admin.actor, cierreId, 'reabrir', 'Rectificación solicitada por la familia');
      const reabierto = await db().selectFrom('cierres_evaluacion').select(['estado', 'cerrado_en', 'publicado_en']).where('id', '=', cierreId).executeTakeFirstOrThrow();
      expect(reabierto).toEqual({ estado: 'borrador', cerrado_en: null, publicado_en: null });
      const auditoria = await db().selectFrom('bitacora').select(['accion', 'motivo']).where('entidad', '=', 'cierres_evaluacion').where('registro_id', '=', cierreId).execute();
      expect(auditoria.map((x) => x.accion)).toEqual(expect.arrayContaining(['reapertura', 'reabrir']));
      expect(auditoria.find((x) => x.accion === 'reabrir')?.motivo).toMatch(/familia/);
    }));

  it('publicado: el estudiante y el apoderado con acceso ven sus logros; sin acceso académico → Forbidden', () =>
    enPrueba(async () => {
      const e = await crearEscenario();
      const cierreId = await abrirRegistro(e, 1);
      await calificarTodo(e, 1, (i, k) => (i === 0 && k === e.competencias.k2 ? 'B' : 'AD'));
      await abrirRegistro(e, 2);
      await calificarTodo(e, 2); // registrado pero NO publicado
      await cierres.ejecutarAccion(e.admin.actor, cierreId, 'cerrar');

      const [a1, a2] = e.alumnos;
      if (!a1?.usuario || !a2) throw new Error('faltan alumnos');
      const alumno = await actorDe(a1.usuario);
      // Cerrado pero no publicado: aún no se ve.
      expect((await notas.notasEstudiante(alumno)).boleta?.bimestres).toEqual([]);
      await cierres.ejecutarAccion(e.admin.actor, cierreId, 'publicar');

      const propia = await notas.notasEstudiante(alumno);
      expect(propia.matriculas.map((m) => m.id)).toEqual([a1.matriculaId]);
      expect(propia.boleta?.bimestres.map((b) => b.numero)).toEqual([1]);
      const com = propia.boleta?.areas.find((x) => x.area === 'Comunicación');
      expect(com?.competencias).toHaveLength(2);
      const lectora = com?.competencias.find((c) => c.id === e.competencias.k2);
      expect(lectora?.bimestres['1']).toMatchObject({ nivel: 'B', conclusion: expect.stringContaining('reforzar') });
      expect(lectora?.bimestres['2']).toBeUndefined();
      // No puede ver la matrícula de otro alumno.
      await esperarError(notas.notasEstudiante(alumno, a2.matriculaId), 'Forbidden');
      await esperarError(notas.libretaEstudiante(alumno, a2.matriculaId), 'Forbidden');
      const pdf = await notas.libretaEstudiante(alumno, a1.matriculaId);
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');

      // Apoderado con acceso académico.
      const madre = await crearUsuario({ roles: ['apoderado'] });
      await vincularApoderado({ estudianteId: a1.estudianteId, personaId: madre.personaId, verificadoPor: e.admin.usuarioId, academico: true });
      const actorMadre = await actorDe(madre);
      const hijo = await notas.notasHijo(actorMadre, a1.estudianteId);
      expect(hijo.boleta?.areas.flatMap((x) => x.competencias)).toHaveLength(3);
      const libreta = await notas.libretaHijo(actorMadre, a1.estudianteId, a1.matriculaId);
      expect(libreta.subarray(0, 4).toString()).toBe('%PDF');
      await esperarError(notas.notasHijo(actorMadre, a2.estudianteId), 'Forbidden');

      // Apoderado SIN acceso académico.
      const padre = await crearUsuario({ roles: ['apoderado'] });
      await vincularApoderado({ estudianteId: a1.estudianteId, personaId: padre.personaId, verificadoPor: e.admin.usuarioId, academico: false, economico: true });
      const actorPadre = await actorDe(padre);
      await esperarError(notas.notasHijo(actorPadre, a1.estudianteId), 'Forbidden', /académica/);
      await esperarError(notas.libretaHijo(actorPadre, a1.estudianteId, a1.matriculaId), 'Forbidden');

      // Libretas desde administración (auditado).
      const { pdf: individual } = await notas.libretaAdmin(e.admin.actor, a1.matriculaId);
      expect(individual.subarray(0, 4).toString()).toBe('%PDF');
      const seccion = await notas.libretasSeccion(e.admin.actor, e.seccionId);
      expect(seccion.subarray(0, 4).toString()).toBe('%PDF');
      const listado = await notas.listarLibretas({ seccionId: e.seccionId }, { limite: 10, desplazamiento: 0 });
      expect(listado.filas.map((f) => f.bimestres_publicados)).toEqual([1, 1]);
    }));
});
