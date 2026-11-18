import { z } from 'zod';
import { consultaListado, id, idOpcional, textoRequerido } from '../comunes';
import { esquemaCriterios, type Criterios } from './criterios';

export const consultaReglas = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  estado: z.enum(['borrador', 'aprobada']).optional(),
});

export const esquemaRegla = z.object({
  anioId: id,
  gradoId: id,
  referenciaNormativa: textoRequerido(300),
  criterios: esquemaCriterios,
});

export type DatosRegla = z.infer<typeof esquemaRegla>;

/** Formulario: los criterios se editan como texto JSON y se validan con el mismo esquema. */
export const esquemaFormularioRegla = z
  .object({
    anioId: id,
    gradoId: id,
    referenciaNormativa: textoRequerido(300),
    criteriosJson: z.string().min(2, 'Ingrese los criterios en JSON'),
  })
  .superRefine((d, ctx) => {
    let valor: unknown;
    try {
      valor = JSON.parse(d.criteriosJson);
    } catch {
      ctx.addIssue({ code: 'custom', path: ['criteriosJson'], message: 'JSON inválido' });
      return;
    }
    const r = esquemaCriterios.safeParse(valor);
    if (!r.success) {
      const p = r.error.issues[0];
      ctx.addIssue({ code: 'custom', path: ['criteriosJson'], message: p ? `${p.path.join('.') || 'criterios'}: ${p.message}` : 'Criterios inválidos' });
    }
  });

export type FormularioRegla = z.infer<typeof esquemaFormularioRegla>;

export interface FilaRegla {
  id: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: number;
  nivel: string;
  version: number;
  referencia_normativa: string;
  criterios: Criterios | Record<string, unknown>;
  aprobado_en: string | null;
  aprobado_por: string | null;
  evidencia_id: string | null;
  usos: number;
}
