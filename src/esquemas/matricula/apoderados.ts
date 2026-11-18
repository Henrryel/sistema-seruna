import { z } from 'zod';
import { booleano, fecha, fechaOpcional } from '../comunes';
import { conPersona, PARENTESCOS } from './comunes';

export const esquemaVinculo = conPersona({
  parentesco: z.enum(PARENTESCOS),
  desde: fecha,
  hasta: fechaOpcional,
}).refine((d) => !d.hasta || d.hasta >= d.desde, { message: 'El fin debe ser igual o posterior al inicio', path: ['hasta'] });

export type DatosVinculo = z.infer<typeof esquemaVinculo>;

export const esquemaAccesos = z.object({ accesoAcademico: booleano, accesoEconomico: booleano });
export type DatosAccesos = z.infer<typeof esquemaAccesos>;

export const esquemaTerminarVinculo = z.object({ fin: fecha });

export interface FilaApoderado {
  id: string;
  estudiante_id: string;
  persona_id: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  correo_contacto: string | null;
  documento: string | null;
  parentesco: string;
  desde: string;
  /** Fin inclusivo (null = indefinido). */
  hasta: string | null;
  vigente: boolean;
  verificado_en: string | null;
  verificado_por: string | null;
  evidencia_id: string | null;
  acceso_academico: boolean;
  acceso_economico: boolean;
  usuario_login: string | null;
}
