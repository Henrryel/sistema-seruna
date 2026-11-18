import { z } from 'zod';
import { consultaListado, fecha, id, idOpcional } from '../comunes';
import { idSeleccionOpcional } from './seleccion';

export const esquemaPlan = z.object({
  anioId: id,
  gradoId: id,
  /** Si se omite, se usa la siguiente versión disponible para el año y grado. */
  version: z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().max(1000).optional()),
  /** Copia asignaturas, competencias y mapeo de otro plan (nueva versión). */
  basadoEn: idSeleccionOpcional,
});

export type DatosPlan = z.infer<typeof esquemaPlan>;

export const esquemaAsignaturaPlan = z.object({ asignaturaId: id });
export const esquemaCompetenciaPlan = z.object({ competenciaId: id });
export const esquemaMapeo = z.object({ asignaturaId: id, competenciaIds: z.array(id).max(60) });

export type DatosMapeo = z.infer<typeof esquemaMapeo>;

export const esquemaVigencia = z
  .object({ inicio: fecha, fin: fecha })
  .refine((d) => d.fin >= d.inicio, { message: 'El fin debe ser posterior al inicio', path: ['fin'] });

export const esquemaAsignarSeccion = z
  .object({ seccionId: id, inicio: fecha, fin: fecha })
  .refine((d) => d.fin >= d.inicio, { message: 'El fin debe ser posterior al inicio', path: ['fin'] });

export type DatosAsignarSeccion = z.infer<typeof esquemaAsignarSeccion>;

export const consultaPlanes = consultaListado.extend({
  anioId: idOpcional,
  gradoId: idOpcional,
  estado: z.enum(['borrador', 'publicado']).optional(),
});

export interface FilaPlan {
  id: string;
  anio_id: string;
  anio: number;
  grado_id: string;
  grado: string;
  version: number;
  publicado_en: string | null;
  asignaturas: number;
  competencias: number;
  secciones: number;
}

export interface AsignaturaDelPlan {
  asignatura_id: string;
  codigo: string;
  nombre: string;
  es_taller: boolean;
  competencias: string[];
}

export interface CompetenciaDelPlan {
  competencia_id: string;
  codigo: string;
  nombre: string;
  version: number;
  reportable_siagie: boolean;
  area: string | null;
}

export interface SeccionDelPlan {
  id: string;
  seccion_id: string;
  seccion: string;
  inicio: string | null;
  fin: string | null;
  cursos: number;
}

export interface DetallePlan extends FilaPlan {
  anio_inicio: string;
  anio_fin: string;
  lista_asignaturas: AsignaturaDelPlan[];
  lista_competencias: CompetenciaDelPlan[];
  lista_secciones: SeccionDelPlan[];
}
