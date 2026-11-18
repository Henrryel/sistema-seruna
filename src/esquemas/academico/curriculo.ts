import { z } from 'zod';
import { booleano, consultaListado, idOpcional, textoRequerido } from '../comunes';
import { idSeleccionOpcional } from './seleccion';

const codigo = z.string().trim().toUpperCase().min(1, 'Requerido').max(30, 'Máximo 30 caracteres');

export const esquemaArea = z.object({ codigo, nombre: textoRequerido(150) });
export type DatosArea = z.infer<typeof esquemaArea>;

export const esquemaAsignatura = z.object({
  codigo,
  nombre: textoRequerido(150),
  areaId: idSeleccionOpcional,
  esTaller: booleano.default(false),
});
export type DatosAsignatura = z.infer<typeof esquemaAsignatura>;

export const esquemaCompetencia = z.object({
  codigo,
  nombre: textoRequerido(500),
  version: z.coerce.number({ invalid_type_error: 'Ingrese un número' }).int('Ingrese un número entero').max(1000).default(1),
  reportableSiagie: booleano.default(true),
  areaId: idSeleccionOpcional,
});
export type DatosCompetencia = z.infer<typeof esquemaCompetencia>;

export const esquemaCapacidad = z.object({ codigo, nombre: textoRequerido(500) });
export type DatosCapacidad = z.infer<typeof esquemaCapacidad>;

export const consultaAreas = consultaListado;
export const consultaAsignaturas = consultaListado.extend({ areaId: idOpcional, esTaller: z.enum(['true', 'false']).optional() });
export const consultaCompetencias = consultaListado.extend({ areaId: idOpcional, reportable: z.enum(['true', 'false']).optional() });

export interface FilaArea {
  id: string;
  codigo: string;
  nombre: string;
  asignaturas: number;
  competencias: number;
}

export interface FilaAsignatura {
  id: string;
  codigo: string;
  nombre: string;
  area_id: string | null;
  area: string | null;
  es_taller: boolean;
  planes: number;
}

export interface FilaCompetencia {
  id: string;
  codigo: string;
  nombre: string;
  version: number;
  reportable_siagie: boolean;
  area_id: string | null;
  area: string | null;
  capacidades: number;
}

export interface FilaCapacidad {
  id: string;
  competencia_id: string;
  codigo: string;
  nombre: string;
}
