'use client';
import { useQuery } from '@tanstack/react-query';
import { api, conConsulta } from './api';

export interface Opcion {
  valor: string;
  etiqueta: string;
  extra?: Record<string, string | number | boolean | null>;
}

export type TipoCatalogo =
  | 'anios'
  | 'bimestres'
  | 'niveles'
  | 'grados'
  | 'secciones'
  | 'aulas'
  | 'areas'
  | 'competencias'
  | 'asignaturas'
  | 'planes'
  | 'docentes'
  | 'cajas'
  | 'series'
  | 'lectores'
  | 'conceptos'
  | 'tipos-documento'
  | 'tipos-reporte'
  | 'politicas';

/** Opciones para selects desde /api/catalogos/[tipo]. `habilitado=false` evita la consulta. */
export function useCatalogo(
  tipo: TipoCatalogo,
  params: Record<string, string | undefined | null> = {},
  habilitado = true,
) {
  const url = conConsulta(`/api/catalogos/${tipo}`, params);
  return useQuery({
    queryKey: ['catalogo', tipo, params],
    queryFn: async () => (await api.get<{ opciones: Opcion[] }>(url)).opciones,
    enabled: habilitado,
    staleTime: 60_000,
  });
}
