'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { BoletaLogros } from '@/components/evaluacion/boleta-logros';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import type { RespuestaNotasPortal } from '@/esquemas/evaluacion/notas';

export function ClienteNotasEstudiante() {
  const [matriculaId, setMatriculaId] = useState<string | null>(null);
  const consulta = useQuery({
    queryKey: ['mis-logros', matriculaId],
    queryFn: () => api.get<RespuestaNotasPortal>(conConsulta('/api/estudiante/notas', { matriculaId })),
  });
  const actual = consulta.data?.boleta?.matricula.id ?? null;
  return (
    <>
      <EncabezadoPagina titulo="Mis logros de aprendizaje" descripcion="Niveles de logro y conclusiones descriptivas de los bimestres publicados." />
      {consulta.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : consulta.isError ? (
        <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          {mensajeDeError(consulta.error)}
        </p>
      ) : (
        <BoletaLogros
          datos={consulta.data}
          matriculaId={actual}
          alCambiarMatricula={setMatriculaId}
          urlLibreta={actual ? conConsulta('/api/estudiante/notas/libreta', { matriculaId: actual }) : null}
        />
      )}
    </>
  );
}
