'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { BoletaLogros } from '@/components/evaluacion/boleta-logros';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import type { RespuestaNotasPortal } from '@/esquemas/evaluacion/notas';

export function ClienteNotasPadre({ estudianteId, nombre }: { estudianteId: string; nombre: string }) {
  const [matriculaId, setMatriculaId] = useState<string | null>(null);
  const consulta = useQuery({
    queryKey: ['logros-hijo', estudianteId, matriculaId],
    queryFn: () => api.get<RespuestaNotasPortal>(conConsulta('/api/padre/notas', { estudianteId, matriculaId })),
  });
  const actual = consulta.data?.boleta?.matricula.id ?? null;
  return (
    <>
      <EncabezadoPagina titulo={`Logros de ${nombre}`} descripcion="Niveles de logro y conclusiones descriptivas de los bimestres publicados." />
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
          urlLibreta={actual ? conConsulta('/api/padre/notas/libreta', { estudianteId, matriculaId: actual }) : null}
        />
      )}
    </>
  );
}
