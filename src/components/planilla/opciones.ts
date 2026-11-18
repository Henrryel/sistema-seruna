'use client';
import { useQuery } from '@tanstack/react-query';
import { api, conConsulta } from '@/lib/api';
import type { OpcionContrato } from '@/esquemas/planilla/contratos';
import type { OpcionSesion } from '@/esquemas/planilla/horas';

/** Contratos para selects (por modalidad, vigentes en fecha o cruzados con un mes). */
export function useOpcionesContrato(
  params: { modalidad?: 'fijo' | 'por_horas'; fecha?: string; mes?: string },
  habilitado = true,
) {
  return useQuery({
    queryKey: ['planilla', 'opciones-contrato', params],
    queryFn: async () =>
      (
        await api.get<{ opciones: OpcionContrato[] }>(
          conConsulta('/api/admin/planilla/contratos/opciones', params),
        )
      ).opciones,
    enabled: habilitado,
    staleTime: 30_000,
  });
}

/** Sesiones realizadas del docente del contrato en la fecha. */
export function useSesionesRealizadas(contratoId: string | undefined, fecha: string | undefined) {
  const habilitado = Boolean(contratoId && fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha));
  return useQuery({
    queryKey: ['planilla', 'sesiones', contratoId, fecha],
    queryFn: async () =>
      (
        await api.get<{ opciones: OpcionSesion[] }>(
          conConsulta('/api/admin/planilla/sesiones', { contratoId, fecha }),
        )
      ).opciones,
    enabled: habilitado,
  });
}
