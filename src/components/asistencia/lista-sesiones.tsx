'use client';
import { BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeEstado } from '@/components/datos/badges';
import { EstadoVacio } from '@/components/datos/basicos';
import { cn } from '@/lib/utils';
import { formatoHora } from '@/lib/formato';
import type { FilaSesion } from '@/esquemas/asistencia/registro';

/** Lista seleccionable de sesiones de clase del día. */
export function ListaSesiones(props: { sesiones?: FilaSesion[]; cargando: boolean; seleccionada: string; alSeleccionar: (id: string) => void }) {
  if (props.cargando) return <Skeleton className="h-20 w-full" />;
  const lista = props.sesiones ?? [];
  if (lista.length === 0) return <EstadoVacio titulo="Sin sesiones" descripcion="No hay sesiones de clase programadas en esa fecha." icono={<BookOpen className="size-8" aria-hidden />} />;
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Sesiones de clase">
      {lista.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            aria-pressed={props.seleccionada === s.id}
            onClick={() => props.alSeleccionar(s.id)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              props.seleccionada === s.id && 'border-primary bg-accent',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{s.curso}</span>
              <BadgeEstado estado={s.estado} />
            </span>
            <span className="block text-sm text-muted-foreground">
              {formatoHora(s.hora_inicio)}–{formatoHora(s.hora_fin)} · {s.seccion}
            </span>
            <span className="block text-xs text-muted-foreground">
              {s.docente} · {s.registrados} registro(s)
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
