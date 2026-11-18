import { describe, expect, it } from 'vitest';
import { CRITERIOS_EJEMPLO, esquemaCriterios, evaluarCriterios, leerCriterios, type Criterios, type ResultadoParaCriterio } from '@/esquemas/evaluacion/criterios';

const r = (competenciaId: string, areaCodigo: string, nivel: ResultadoParaCriterio['nivel']): ResultadoParaCriterio => ({ competenciaId, areaCodigo, nivel });

describe('criterios de evaluación (esquema y evaluador)', () => {
  it('el ejemplo cumple el esquema y se rechazan formas inválidas', () => {
    expect(esquemaCriterios.parse(CRITERIOS_EJEMPLO)).toEqual(CRITERIOS_EJEMPLO);
    expect(leerCriterios({}).ok).toBe(false);
    const sinUmbral = structuredClone(CRITERIOS_EJEMPLO) as unknown as { reglas: { condiciones: Record<string, unknown>[] }[] };
    delete sinUmbral.reglas[0]!.condiciones[0]!.umbralArea;
    expect(leerCriterios(sinUmbral).ok).toBe(false);
    const ambos = structuredClone(CRITERIOS_EJEMPLO) as unknown as { reglas: { condiciones: Record<string, unknown>[] }[] };
    ambos.reglas[1]!.condiciones[0]!.proporcion = 0.5;
    expect(leerCriterios(ambos).ok).toBe(false);
  });

  it('aplica las reglas en orden y marca pendientes', () => {
    const todosA = [r('1', 'COM', 'A'), r('2', 'COM', 'AD'), r('3', 'MAT', 'A')];
    expect(evaluarCriterios(CRITERIOS_EJEMPLO, todosA)).toMatchObject({ situacion: 'promovido', regla: null, pendientes: [] });
    const unaC = [r('1', 'COM', 'A'), r('2', 'COM', 'B'), r('3', 'MAT', 'C')];
    expect(evaluarCriterios(CRITERIOS_EJEMPLO, unaC)).toMatchObject({ situacion: 'recuperacion', pendientes: ['3'] });
    // C en más de la mitad de las competencias de 4 áreas → permanencia.
    const cuatroAreas = ['A1', 'A2', 'A3', 'A4'].flatMap((a) => [r(`${a}-1`, a, 'C'), r(`${a}-2`, a, 'C'), r(`${a}-3`, a, 'B')]);
    expect(evaluarCriterios(CRITERIOS_EJEMPLO, cuatroAreas).situacion).toBe('permanencia');
    // Tras la etapa de recuperación, si persiste se sugiere la situación configurada.
    expect(evaluarCriterios(CRITERIOS_EJEMPLO, unaC, { etapa: 'recuperacion' }).situacion).toBe('permanencia');
  });

  it('respeta áreas excluidas, proporciones y combinación "alguna"', () => {
    const c: Criterios = {
      ...CRITERIOS_EJEMPLO,
      areasExcluidas: ['TALLER'],
      reglas: [
        {
          situacion: 'recuperacion',
          descripcion: 'La mitad o más en B/C, o alguna en C',
          combinar: 'alguna',
          condiciones: [
            { ambito: 'competencias', niveles: ['B', 'C'], comparador: 'al_menos', proporcion: 0.5 },
            { ambito: 'competencias', niveles: ['C'], comparador: 'al_menos', cantidad: 1 },
          ],
        },
      ],
    };
    expect(evaluarCriterios(c, [r('1', 'COM', 'A'), r('2', 'TALLER', 'C')]).situacion).toBe('promovido');
    expect(evaluarCriterios(c, [r('1', 'COM', 'A'), r('2', 'MAT', 'B')]).situacion).toBe('recuperacion');
  });
});
