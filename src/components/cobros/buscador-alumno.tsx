'use client';
import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeEstado } from '@/components/datos/badges';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import type { AlumnoBusqueda } from '@/esquemas/cobros/pagos';
import { cn } from '@/lib/utils';

function useDebounce<T>(valor: T, ms = 350): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/** Buscador de alumnos (apellidos, nombres, código o documento) para cobros. */
export function BuscadorAlumno(props: {
  alSeleccionar: (alumno: AlumnoBusqueda) => void;
  seleccionado?: string | null;
  etiqueta?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const idCampo = useId();
  const [texto, setTexto] = useState('');
  const q = useDebounce(texto.trim());
  const consulta = useQuery({
    queryKey: ['cobros', 'alumnos', q],
    queryFn: () => api.get<{ alumnos: AlumnoBusqueda[] }>(conConsulta('/api/admin/cobros/alumnos', { q })),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
  const alumnos = consulta.data?.alumnos ?? [];

  return (
    <div className={cn('grid gap-2', props.className)}>
      <Label htmlFor={idCampo}>{props.etiqueta ?? 'Buscar alumno'}</Label>
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={idCampo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Apellidos, nombres, código o DNI"
          className="pl-8"
          autoComplete="off"
          autoFocus={props.autoFocus}
          aria-describedby={`${idCampo}-ayuda`}
        />
        {consulta.isFetching ? <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      <p id={`${idCampo}-ayuda`} className="text-xs text-muted-foreground">
        Escriba al menos 2 caracteres.
      </p>
      {q.length >= 2 ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border" aria-live="polite">
          {consulta.isPending ? (
            <div className="grid gap-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : consulta.isError ? (
            <p role="alert" className="p-3 text-sm text-peligro-foreground">
              {mensajeDeError(consulta.error)}
            </p>
          ) : alumnos.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No se encontraron alumnos.</p>
          ) : (
            <ul className="divide-y">
              {alumnos.map((a) => (
                <li key={a.estudiante_id}>
                  <button
                    type="button"
                    onClick={() => props.alSeleccionar(a)}
                    aria-pressed={props.seleccionado === a.estudiante_id}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                      props.seleccionado === a.estudiante_id && 'bg-accent',
                    )}
                  >
                    <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {a.apellidos}, {a.nombres}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.codigo}
                        {a.documento ? ` · ${a.documento}` : ''}
                        {a.anio ? ` · ${a.anio} · ${a.grado ?? ''}${a.seccion ? ` "${a.seccion}"` : ''}` : ' · sin matrícula'}
                      </span>
                    </span>
                    {a.estado_matricula ? <BadgeEstado estado={a.estado_matricula} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
