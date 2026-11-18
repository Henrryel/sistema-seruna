import { z } from 'zod';
import { consultaListado, fechaOpcional, idOpcional } from '../comunes';

export const consultaBitacora = consultaListado
  .extend({
    /** Eventos en que el usuario fue actor o afectado. */
    usuarioId: idOpcional,
    accion: z.string().trim().max(60).optional(),
    entidad: z.string().trim().max(60).optional(),
    resultado: z.string().trim().max(30).optional(),
    /** Login (o parte) del actor. */
    actor: z.string().trim().max(60).optional(),
    desde: fechaOpcional,
    hasta: fechaOpcional,
  })
  .refine((d) => !d.desde || !d.hasta || d.hasta >= d.desde, { message: 'El rango de fechas es inválido', path: ['hasta'] });

export type ConsultaBitacora = z.infer<typeof consultaBitacora>;

export interface FilaBitacora {
  id: string;
  ocurrido_en: string;
  actor_login: string | null;
  afectado_login: string | null;
  accion: string;
  entidad: string;
  registro_id: string | null;
  motivo: string | null;
  resultado: string;
}

export interface OpcionesBitacora {
  acciones: string[];
  entidades: string[];
  resultados: string[];
}
