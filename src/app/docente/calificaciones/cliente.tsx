'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { GrillaCalificaciones } from '@/components/evaluacion/grilla-calificaciones';
import { SelectorCampo, bimestrePorDefecto } from '@/components/evaluacion/selectores';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { hoyLima } from '@/lib/formato';
import type { CursoDocente, GrillaCalificaciones as Grilla, ResultadoGuardado } from '@/esquemas/evaluacion/calificaciones';

const ENDPOINT = '/api/docente/calificaciones';

export function ClienteCalificacionesDocente() {
  const cursos = useQuery({ queryKey: ['docente-cursos-calificables'], queryFn: () => api.get<{ cursos: CursoDocente[] }>(`${ENDPOINT}/cursos`) });
  const [cursoId, setCursoId] = useState<string | null>(null);
  const [bimestreId, setBimestreId] = useState<string | null>(null);
  const curso = cursos.data?.cursos.find((c) => c.cursoId === cursoId) ?? null;
  const bimestres = useCatalogo('bimestres', { anioId: curso?.anioId }, Boolean(curso));

  useEffect(() => {
    if (!cursoId && cursos.data?.cursos[0]) setCursoId(cursos.data.cursos[0].cursoId);
  }, [cursos.data, cursoId]);
  useEffect(() => {
    if (bimestres.data && (!bimestreId || !bimestres.data.some((b) => b.valor === bimestreId))) setBimestreId(bimestrePorDefecto(bimestres.data, hoyLima()));
  }, [bimestres.data, bimestreId]);

  const consulta = { cursoId: cursoId ?? '', bimestreId: bimestreId ?? '' };
  const grilla = useQuery({
    queryKey: ['grilla-docente', consulta],
    queryFn: () => api.get<Grilla>(conConsulta(ENDPOINT, consulta)),
    enabled: Boolean(cursoId && bimestreId),
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Calificaciones por competencias"
        descripcion="Registre el nivel de logro (AD, A, B, C) y la conclusión descriptiva de cada estudiante en las competencias de su curso."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
        <SelectorCampo
          etiqueta="Curso"
          valor={cursoId}
          alCambiar={setCursoId}
          cargando={cursos.isPending}
          opciones={(cursos.data?.cursos ?? []).map((c) => ({ valor: c.cursoId, etiqueta: `${c.asignatura} · ${c.grado}.º ${c.seccion} ${c.nivel} (${c.anio})` }))}
        />
        <SelectorCampo
          etiqueta="Bimestre"
          valor={bimestreId}
          alCambiar={setBimestreId}
          cargando={Boolean(curso) && bimestres.isPending}
          deshabilitado={!curso}
          opciones={bimestres.data ?? []}
        />
      </div>
      {cursos.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {mensajeDeError(cursos.error)}
        </p>
      ) : cursos.data && !cursos.data.cursos.length ? (
        <EstadoVacio titulo="Sin cursos asignados" descripcion="No tiene asignaciones vigentes en un año académico abierto." />
      ) : grilla.isError ? (
        <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          {mensajeDeError(grilla.error)}
        </p>
      ) : grilla.data ? (
        <GrillaCalificaciones
          key={`${cursoId}-${bimestreId}`}
          grilla={grilla.data}
          urlHistorial={conConsulta(`${ENDPOINT}/historial`, consulta)}
          guardar={(celdas, motivo) => api.post<ResultadoGuardado>(ENDPOINT, { ...consulta, celdas, motivo })}
          alGuardar={() => grilla.refetch()}
        />
      ) : cursoId && bimestreId ? (
        <Skeleton className="h-64 w-full" />
      ) : null}
    </>
  );
}
