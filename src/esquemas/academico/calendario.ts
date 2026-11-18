import { z } from 'zod';
import { consultaListado, fecha, fechaOpcional, id, textoOpcional } from '../comunes';

export const TIPOS_DIA = ['lectivo', 'feriado', 'no_lectivo'] as const;
export type TipoDia = (typeof TIPOS_DIA)[number];

export const NOMBRE_TIPO_DIA: Record<string, string> = {
  lectivo: 'Lectivo',
  feriado: 'Feriado',
  no_lectivo: 'No lectivo',
};

export const esquemaDiaCalendario = z.object({
  anioId: id,
  fecha,
  tipo: z.enum(TIPOS_DIA),
  descripcion: textoOpcional(200),
});

export type DatosDiaCalendario = z.infer<typeof esquemaDiaCalendario>;

export const esquemaActualizarDia = z.object({
  tipo: z.enum(TIPOS_DIA),
  descripcion: textoOpcional(200),
});

export const parametrosDia = z.object({ anioId: id, fecha });

export const esquemaGenerarLectivos = z
  .object({
    anioId: id,
    desde: fecha,
    hasta: fecha,
    descripcion: textoOpcional(200),
  })
  .refine((d) => d.hasta >= d.desde, { message: 'El fin debe ser posterior al inicio', path: ['hasta'] });

export type DatosGenerarLectivos = z.infer<typeof esquemaGenerarLectivos>;

export const consultaCalendario = consultaListado.extend({
  anioId: id,
  tipo: z.enum(TIPOS_DIA).optional(),
  desde: fechaOpcional,
  hasta: fechaOpcional,
});

export interface FilaDiaCalendario {
  anio_id: string;
  fecha: string;
  tipo: string;
  descripcion: string | null;
  dia_semana: number;
}

export interface ResumenCalendario {
  lectivo: number;
  feriado: number;
  no_lectivo: number;
}
