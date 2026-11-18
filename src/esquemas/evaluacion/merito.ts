import { z } from 'zod';
import { consultaListado, id, idOpcional, textoOpcional, textoRequerido } from '../comunes';

export const ALCANCES_MERITO = ['grado', 'secundaria_completa'] as const;

export const ETIQUETA_ALCANCE: Record<(typeof ALCANCES_MERITO)[number], string> = {
  grado: 'Por grado',
  secundaria_completa: 'Secundaria completa (5.º)',
};

export const consultaPublicaciones = consultaListado.extend({ anioId: idOpcional, gradoId: idOpcional });

/** Campos del FormData al registrar el listado oficial (el archivo va en `archivo`). */
export const esquemaPublicacion = z.object({
  anioId: id,
  gradoId: id,
  alcance: z.enum(ALCANCES_MERITO),
  referenciaSiagie: textoRequerido(200),
});

export type DatosPublicacion = z.infer<typeof esquemaPublicacion>;

/** Calificativo 2.5–10 con hasta 3 decimales (numeric(6,3)); el rango lo valida la base. */
const calificativo = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(',', '.'))
  .refine((v) => /^\d{1,3}(\.\d{1,3})?$/.test(v), 'Calificativo inválido (hasta 3 decimales)');

export const esquemaPuesto = z.object({
  matriculaId: id,
  puesto: z.coerce.number().int().min(1),
  calificativo,
  sustentoDesempate: textoOpcional(500),
});

export const esquemaPuestos = z.object({ puestos: z.array(esquemaPuesto).min(1).max(500) });
export const consultaQuitarPuesto = z.object({ matriculaId: id });

export interface FilaPublicacion {
  id: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: number;
  nivel: string;
  alcance: string;
  version: number;
  referencia_siagie: string;
  archivo_siagie_id: string;
  archivo: string;
  registrado_en: string;
  publicado_en: string | null;
  puestos: number;
}

export interface PuestoMerito {
  matricula_id: string;
  cierre_anual_id: string;
  codigo: string;
  codigo_siagie: string | null;
  alumno: string;
  seccion: string | null;
  puesto: number;
  calificativo: string;
  sustento_desempate: string | null;
}

export interface CandidatoMerito {
  matricula_id: string;
  cierre_anual_id: string;
  codigo: string;
  codigo_siagie: string | null;
  alumno: string;
  seccion: string | null;
  situacion: string;
}

export interface DetallePublicacion extends FilaPublicacion {
  puestosDetalle: PuestoMerito[];
  candidatos: CandidatoMerito[];
}
