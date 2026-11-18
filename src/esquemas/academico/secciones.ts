import { z } from 'zod';
import { booleano, consultaListado, id, idOpcional, textoRequerido } from '../comunes';

export const TURNOS = ['Mañana', 'Tarde'] as const;

const entero = (max: number) => z.coerce.number({ invalid_type_error: 'Ingrese un número' }).int('Ingrese un número entero').max(max, `Máximo ${max}`);

/** Cupo, reserva ≤ cupo y nombre en mayúsculas los valida la base; aquí se normaliza el nombre. */
export const esquemaSeccion = z.object({
  anioId: id,
  gradoId: id,
  nombre: z.string().trim().toUpperCase().min(1, 'Requerido').max(20, 'Máximo 20 caracteres'),
  turno: textoRequerido(30),
  cupo: entero(500),
  reserva: entero(500).default(2),
  activa: booleano.default(true),
});

export type DatosSeccion = z.infer<typeof esquemaSeccion>;

export const consultaSecciones = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  activa: z.enum(['true', 'false']).optional(),
});

export interface FilaSeccion {
  id: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: string;
  nivel: string;
  nombre: string;
  turno: string;
  cupo: number;
  reserva: number;
  activa: boolean;
  ocupadas: number;
  /** Fecha de referencia de la ocupación (hoy acotado al año escolar). */
  fecha_ocupacion: string;
  plan_vigente: string | null;
  cursos: number;
}

const capacidad = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number({ invalid_type_error: 'Ingrese un número' }).int('Ingrese un número entero').max(10_000).nullable(),
);

export const esquemaAula = z.object({
  codigo: z.string().trim().toUpperCase().min(1, 'Requerido').max(20, 'Máximo 20 caracteres'),
  nombre: textoRequerido(100),
  capacidad,
  activa: booleano.default(true),
});

export type DatosAula = z.infer<typeof esquemaAula>;

export const consultaAulas = consultaListado.extend({ activa: z.enum(['true', 'false']).optional() });

export interface FilaAula {
  id: string;
  codigo: string;
  nombre: string;
  capacidad: number | null;
  activa: boolean;
  bloques: number;
}

export interface FilaGrado {
  id: string;
  nivel_id: string;
  nivel: string;
  nivel_codigo: string;
  numero: number;
  secciones: number;
  cupo_total: number;
  ocupadas: number;
}
