'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { GrillaCalificaciones } from '@/components/evaluacion/grilla-calificaciones';
import { SelectorAnio, SelectorCampo, SelectorSeccion, bimestrePorDefecto, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { hoyLima } from '@/lib/formato';
import type { GrillaCalificaciones as Grilla, ResultadoGuardado } from '@/esquemas/evaluacion/calificaciones';

const ENDPOINT = '/api/admin/evaluacion/calificaciones';

export function ClienteCalificacionesAdmin() {
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [seccionId, setSeccionId] = useState<string | null>(null);
  const [bimestreId, setBimestreId] = useState<string | null>(null);
  const [cursoId, setCursoId] = useState<string | null>(null);
  const bimestres = useCatalogo('bimestres', { anioId: anioId ?? undefined }, Boolean(anioId));

  useEffect(() => {
    if (bimestres.data && (!bimestreId || !bimestres.data.some((b) => b.valor === bimestreId))) setBimestreId(bimestrePorDefecto(bimestres.data, hoyLima()));
  }, [bimestres.data, bimestreId]);

  const consulta = { seccionId: seccionId ?? '', bimestreId: bimestreId ?? '', cursoId: cursoId ?? undefined };
  const grilla = useQuery({
    queryKey: ['grilla-admin', consulta],
    queryFn: () => api.get<Grilla>(conConsulta(ENDPOINT, consulta)),
    enabled: Boolean(seccionId && bimestreId),
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Calificaciones por sección"
        descripcion="Consulta y registro administrativo de niveles de logro de cualquier sección. Cada cambio queda auditado."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectorAnio
          anios={anios}
          anioId={anioId}
          alCambiar={(v) => {
            setAnioId(v);
            setSeccionId(null);
            setCursoId(null);
            setBimestreId(null);
          }}
        />
        <SelectorSeccion
          anioId={anioId}
          valor={seccionId}
          alCambiar={(v) => {
            setSeccionId(v);
            setCursoId(null);
          }}
        />
        <SelectorCampo etiqueta="Bimestre" valor={bimestreId} alCambiar={setBimestreId} opciones={bimestres.data ?? []} cargando={Boolean(anioId) && bimestres.isPending} deshabilitado={!anioId} />
        <SelectorCampo
          etiqueta="Curso"
          valor={cursoId}
          alCambiar={setCursoId}
          opcionVacia="Todas las competencias del plan"
          deshabilitado={!grilla.data}
          opciones={(grilla.data?.cursos ?? []).map((c) => ({ valor: c.id, etiqueta: c.asignatura }))}
        />
      </div>
      {!seccionId ? (
        <EstadoVacio titulo="Seleccione una sección" descripcion="Elija el año, la sección y el bimestre para ver la grilla de calificaciones." />
      ) : grilla.isError ? (
        <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          {mensajeDeError(grilla.error)}
        </p>
      ) : grilla.data ? (
        <GrillaCalificaciones
          key={`${seccionId}-${bimestreId}-${cursoId ?? 'plan'}`}
          grilla={grilla.data}
          urlHistorial={conConsulta(`${ENDPOINT}/historial`, consulta)}
          guardar={(celdas, motivo) => api.post<ResultadoGuardado>(ENDPOINT, { ...consulta, celdas, motivo })}
          alGuardar={() => grilla.refetch()}
        />
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </>
  );
}
