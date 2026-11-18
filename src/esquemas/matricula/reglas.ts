import { z } from 'zod';
import { booleano, consultaListado, fecha, fechaOpcional, id, idOpcional, textoOpcional, textoRequerido } from '../comunes';
import { enteroOpcional, TIPOS_INGRESO } from './comunes';

// La base valida ventana (fin ≥ inicio), edades (máx ≥ mín ≥ 0, corte exigido si hay edades) y unicidad de versión.
export const esquemaRegla = z.object({
  anioId: id,
  gradoId: id,
  tipoIngreso: z.enum(TIPOS_INGRESO),
  solicitudesInicio: fecha,
  solicitudesFin: fecha,
  corteEdad: fechaOpcional,
  edadMinima: enteroOpcional,
  edadMaxima: enteroOpcional,
  referenciaNormativa: textoOpcional(300),
});

export type DatosRegla = z.infer<typeof esquemaRegla>;

export const esquemaRequisito = z.object({
  tipoDocumentoId: id,
  obligatorio: booleano.default(true),
  admiteRegularizacion: booleano.default(false),
  plazoRegularizacion: fechaOpcional,
});

export type DatosRequisito = z.infer<typeof esquemaRequisito>;

export const esquemaTipoDocumento = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, 'Requerido')
    .max(30, 'Máximo 30 caracteres')
    .transform((v) => v.toUpperCase().replace(/\s+/g, '_')),
  nombre: textoRequerido(120),
});

export type DatosTipoDocumento = z.infer<typeof esquemaTipoDocumento>;

export const consultaReglas = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  tipoIngreso: z.enum(TIPOS_INGRESO).optional(),
  publicada: z.enum(['true', 'false']).optional(),
});

export const parametrosRequisito = z.object({ id, tipoDocumentoId: id });

export interface FilaRegla {
  id: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: string;
  tipo_ingreso: string;
  version: number;
  solicitudes_inicio: string;
  solicitudes_fin: string;
  corte_edad: string | null;
  edad_minima: number | null;
  edad_maxima: number | null;
  referencia_normativa: string | null;
  publicada_en: string | null;
  requisitos: number;
  matriculas: number;
}

export interface FilaRequisito {
  regla_id: string;
  tipo_documento_id: string;
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  admite_regularizacion: boolean;
  plazo_regularizacion: string | null;
}

export interface FilaTipoDocumento {
  id: string;
  codigo: string;
  nombre: string;
  usos: number;
}
