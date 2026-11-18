import { z } from 'zod';
import { consultaListado, id, idOpcional, textoOpcional } from '../comunes';

export const ESTADOS_CIERRE = ['borrador', 'cerrado', 'publicado'] as const;
export const ACCIONES_CIERRE = ['cerrar', 'publicar', 'reabrir'] as const;
export type AccionCierre = (typeof ACCIONES_CIERRE)[number];

export const ETIQUETA_ACCION_CIERRE: Record<AccionCierre, string> = {
  cerrar: 'Cerrar',
  publicar: 'Publicar',
  reabrir: 'Reabrir',
};

export const consultaCierres = consultaListado.extend({
  anioId: idOpcional,
  bimestreId: idOpcional,
  estado: z.enum(ESTADOS_CIERRE).optional(),
});

/** Abre el registro de notas: crea cierres en borrador (masivo). Sin secciones = todas las activas del año. */
export const esquemaAbrirCierres = z.object({
  bimestreId: id,
  seccionIds: z.array(id).max(500).optional(),
});

const motivoReapertura = z.string().trim().max(500).optional();

export const esquemaAccionCierre = z
  .object({ accion: z.enum(ACCIONES_CIERRE), motivo: motivoReapertura })
  .superRefine((d, ctx) => {
    if (d.accion === 'reabrir' && (d.motivo ?? '').length < 5) {
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Indique el motivo de la reapertura (mínimo 5 caracteres)' });
    }
  });

export const esquemaAccionLote = z
  .object({ ids: z.array(id).min(1).max(500), accion: z.enum(ACCIONES_CIERRE), motivo: motivoReapertura })
  .superRefine((d, ctx) => {
    if (d.accion === 'reabrir' && (d.motivo ?? '').length < 5) {
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Indique el motivo de la reapertura (mínimo 5 caracteres)' });
    }
  });

export type AccionLote = z.infer<typeof esquemaAccionLote>;

export interface FilaCierre {
  id: string;
  seccion_id: string;
  seccion: string;
  grado: number;
  nivel: string;
  bimestre_id: string;
  bimestre: number;
  estado: string;
  cerrado_en: string | null;
  publicado_en: string | null;
  responsable: string;
  esperadas: number;
  registradas: number;
  completas: number;
  pendientes: number;
  sin_conclusion: number;
  /** 0..100 */
  avance: number;
}

export interface FaltanteCierre {
  matricula_id: string;
  alumno: string;
  competencia: string;
  motivo: 'sin_nota' | 'pendiente' | 'sin_conclusion';
}

export interface DetalleCierre extends FilaCierre {
  faltantes: FaltanteCierre[];
  totalFaltantes: number;
}

export interface ResultadoLote {
  id: string;
  ok: boolean;
  mensaje: string;
}

export const esquemaMotivoOpcional = z.object({ motivo: textoOpcional(500) });
