import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { esquemaAsignatura, esquemaCompetencia, esquemaArea } from '@/esquemas/academico/curriculo';
import * as curriculo from '@/server/services/academico/curriculo';
import * as planes from '@/server/services/academico/planes';
import { listarCursos } from '@/server/services/academico/asignaciones';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { crearAdmin, crearAnio, crearSeccion, gradoId, sufijo } from '@tests/fixtures/base';

describe('currículo y planes de estudio', () => {
  it('plan publicado → sección → cursos (la base exige plan publicado y vigencia en el año)', () =>
    enPrueba(async () => {
      const { actor } = await crearAdmin();
      const s = sufijo();
      const anio = await crearAnio();
      const grado = await gradoId('secundaria', 1);
      const seccion = await crearSeccion(anio.anioId, grado, { nombre: 'A' });

      const area = await curriculo.crearArea(actor, esquemaArea.parse({ codigo: ` mat-${s} `, nombre: 'Matemática' }));
      const algebra = await curriculo.crearAsignatura(actor, esquemaAsignatura.parse({ codigo: `alg-${s}`, nombre: 'Álgebra', areaId: area.id }));
      const taller = await curriculo.crearAsignatura(actor, esquemaAsignatura.parse({ codigo: `tal-${s}`, nombre: 'Taller de robótica', esTaller: true }));
      const c1 = await curriculo.crearCompetencia(actor, esquemaCompetencia.parse({ codigo: `c23-${s}`, nombre: 'Resuelve problemas de cantidad', areaId: area.id }));
      const c2 = await curriculo.crearCompetencia(actor, esquemaCompetencia.parse({ codigo: `c24-${s}`, nombre: 'Resuelve problemas de regularidad', areaId: area.id }));
      const codigo = await db().selectFrom('areas_curriculares').select('codigo').where('id', '=', area.id).executeTakeFirstOrThrow();
      expect(codigo.codigo).toBe(`MAT-${s}`.toUpperCase());
      await esperarError(curriculo.crearAsignatura(actor, esquemaAsignatura.parse({ codigo: `ALG-${s}`, nombre: 'Duplicada' })), 'Conflict', /asignatura con ese código/);

      const plan = await planes.crearPlan(actor, { anioId: anio.anioId, gradoId: grado });
      expect(plan.version).toBe(1);
      await planes.agregarAsignatura(actor, plan.id, algebra.id);
      await planes.agregarAsignatura(actor, plan.id, taller.id);
      await planes.agregarCompetencia(actor, plan.id, c1.id);
      await planes.agregarCompetencia(actor, plan.id, c2.id);
      await planes.actualizarMapeo(actor, plan.id, { asignaturaId: algebra.id, competenciaIds: [c1.id, c2.id] });
      await esperarError(planes.agregarAsignatura(actor, plan.id, algebra.id), 'Conflict', /ya está en el plan/);

      // Sin publicar, la base (validar_plan_seccion) rechaza aplicarlo a una sección.
      await esperarError(
        planes.asignarSeccion(actor, plan.id, { seccionId: seccion.id, inicio: anio.inicio, fin: anio.fin }),
        'Validation',
        /plan publicado/,
      );

      await planes.publicar(actor, plan.id);
      const detalle = await planes.obtenerPlan(plan.id);
      expect(detalle.publicado_en).not.toBeNull();
      expect(detalle.lista_asignaturas.find((a) => a.asignatura_id === algebra.id)?.competencias.sort()).toEqual([c1.id, c2.id].sort());

      // Publicado: el servicio impide editar su contenido.
      await esperarError(planes.agregarAsignatura(actor, plan.id, algebra.id), 'Conflict', /publicado/);
      await esperarError(planes.quitarCompetencia(actor, plan.id, c1.id), 'Conflict', /publicado/);
      await esperarError(planes.actualizarMapeo(actor, plan.id, { asignaturaId: algebra.id, competenciaIds: [] }), 'Conflict', /publicado/);
      await esperarError(planes.eliminarPlan(actor, plan.id), 'Conflict', /publicado/);

      // Vigencia fuera del año escolar: la rechaza la base.
      await esperarError(
        planes.asignarSeccion(actor, plan.id, { seccionId: seccion.id, inicio: `${anio.anio - 1}-12-01`, fin: anio.fin }),
        'Validation',
        /dentro del año escolar/,
      );

      const asignado = await planes.asignarSeccion(actor, plan.id, { seccionId: seccion.id, inicio: anio.inicio, fin: anio.fin });
      expect(asignado.cursos).toBe(2);
      const cursos = await listarCursos({ seccionId: seccion.id }, { limite: 20, desplazamiento: 0 });
      expect(cursos.filas.map((c) => c.asignatura_id).sort()).toEqual([algebra.id, taller.id].sort());
      expect(cursos.filas.every((c) => c.plan_inicio === anio.inicio && c.plan_fin === anio.fin)).toBe(true);

      // Solape de vigencia en la misma sección (EXCLUDE) con mensaje claro.
      await esperarError(
        planes.asignarSeccion(actor, plan.id, { seccionId: seccion.id, inicio: anio.inicio, fin: anio.inicio }),
        'Conflict',
        /ya tiene un plan de estudios en ese período/,
      );

      // Nueva versión basada en la publicada: copia el contenido y queda en borrador.
      const v2 = await planes.crearPlan(actor, { anioId: anio.anioId, gradoId: grado, basadoEn: plan.id });
      expect(v2.version).toBe(2);
      const detalle2 = await planes.obtenerPlan(v2.id);
      expect(detalle2.publicado_en).toBeNull();
      expect(detalle2.asignaturas).toBe(2);
      expect(detalle2.competencias).toBe(2);
      expect(detalle2.lista_asignaturas.find((a) => a.asignatura_id === algebra.id)?.competencias).toHaveLength(2);
      await planes.quitarAsignatura(actor, v2.id, algebra.id);
      expect((await planes.obtenerPlan(v2.id)).asignaturas).toBe(1);

      const auditoria = await db().selectFrom('bitacora').select('accion').where('actor_id', '=', actor.usuarioId).where('accion', 'in', ['publicar', 'asignar_plan']).execute();
      expect(auditoria.map((a) => a.accion).sort()).toEqual(['asignar_plan', 'publicar']);
    }));

  it('no publica un plan vacío y el mapeo exige competencias del plan', () =>
    enPrueba(async () => {
      const { actor } = await crearAdmin();
      const s = sufijo();
      const anio = await crearAnio();
      const grado = await gradoId('primaria', 4);
      const plan = await planes.crearPlan(actor, { anioId: anio.anioId, gradoId: grado });
      await esperarError(planes.publicar(actor, plan.id), 'Validation', /al menos una asignatura/);
      const a = await curriculo.crearAsignatura(actor, esquemaAsignatura.parse({ codigo: `X-${s}`, nombre: 'Comunicación' }));
      const c = await curriculo.crearCompetencia(actor, esquemaCompetencia.parse({ codigo: `CX-${s}`, nombre: 'Lee diversos tipos de textos' }));
      await planes.agregarAsignatura(actor, plan.id, a.id);
      // La competencia no está en el plan: la FK compuesta de asignatura_competencias lo rechaza.
      await esperarError(planes.actualizarMapeo(actor, plan.id, { asignaturaId: a.id, competenciaIds: [c.id] }), 'Validation');
      await planes.eliminarPlan(actor, plan.id);
      await esperarError(planes.obtenerPlan(plan.id), 'NotFound');
    }));
});
