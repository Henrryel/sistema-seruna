'use client';
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalogo, type Opcion } from '@/lib/catalogos';
import { hoyLima } from '@/lib/formato';
import { cn } from '@/lib/utils';

// Selectores de contexto para las pantallas académicas (año → sección).

export function SelectSimple(props: {
  etiqueta: string;
  opciones: { valor: string; etiqueta: string }[];
  valor: string | undefined;
  alCambiar: (v: string) => void;
  placeholder?: string;
  deshabilitado?: boolean;
  className?: string;
  cargando?: boolean;
}) {
  if (props.cargando) return <Skeleton className={cn('h-9 w-full sm:w-56', props.className)} />;
  return (
    <Select value={props.valor || undefined} onValueChange={props.alCambiar} disabled={props.deshabilitado}>
      <SelectTrigger className={cn('w-full sm:w-56', props.className)} aria-label={props.etiqueta}>
        <SelectValue placeholder={props.placeholder ?? props.etiqueta} />
      </SelectTrigger>
      <SelectContent>
        {props.opciones.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Año que contiene hoy; si no hay, el primero abierto; si no, el más reciente. */
export function anioPorDefecto(anios: Opcion[]): string | undefined {
  const hoy = hoyLima();
  const actual = anios.find((a) => String(a.extra?.inicio ?? '') <= hoy && hoy <= String(a.extra?.fin ?? ''));
  return (actual ?? anios.find((a) => a.extra?.estado === 'abierto') ?? anios[0])?.valor;
}

export function SelectorAnio(props: { valor: string | undefined; alCambiar: (v: string) => void; className?: string }) {
  const anios = useCatalogo('anios');
  const { valor, alCambiar } = props;
  useEffect(() => {
    if (!valor && anios.data && anios.data.length > 0) {
      const porDefecto = anioPorDefecto(anios.data);
      if (porDefecto) alCambiar(porDefecto);
    }
  }, [valor, anios.data, alCambiar]);
  return (
    <SelectSimple
      etiqueta="Año académico"
      placeholder={anios.data?.length === 0 ? 'No hay años registrados' : 'Año académico'}
      opciones={(anios.data ?? []).map((a) => ({ valor: a.valor, etiqueta: `${a.etiqueta}${a.extra?.estado ? ` · ${a.extra.estado}` : ''}` }))}
      valor={props.valor}
      alCambiar={props.alCambiar}
      cargando={anios.isPending}
      className={props.className}
    />
  );
}

export function SelectorSeccion(props: { anioId: string | undefined; valor: string | undefined; alCambiar: (v: string) => void; className?: string }) {
  const secciones = useCatalogo('secciones', { anioId: props.anioId }, Boolean(props.anioId));
  return (
    <SelectSimple
      etiqueta="Sección"
      placeholder={!props.anioId ? 'Elija un año' : secciones.data?.length === 0 ? 'Sin secciones activas' : 'Sección'}
      opciones={secciones.data ?? []}
      valor={props.valor}
      alCambiar={props.alCambiar}
      deshabilitado={!props.anioId}
      cargando={Boolean(props.anioId) && secciones.isPending}
      className={props.className}
    />
  );
}
