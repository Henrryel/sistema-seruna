'use client';
import { useEffect, useId, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalogo, type Opcion } from '@/lib/catalogos';

const NINGUNO = '__ninguno__';

/** Select con etiqueta visible (accesible) para filtros de pantalla. */
export function SelectorCampo(props: {
  etiqueta: string;
  valor: string | null | undefined;
  alCambiar: (valor: string | null) => void;
  opciones: { valor: string; etiqueta: string }[];
  placeholder?: string;
  cargando?: boolean;
  /** Texto de la opción vacía (si se permite "todos"/"ninguno"). */
  opcionVacia?: string;
  deshabilitado?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`grid gap-1.5 ${props.className ?? ''}`}>
      <Label htmlFor={id}>{props.etiqueta}</Label>
      {props.cargando ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <Select
          // '' (no undefined) para que Radix vuelva al placeholder cuando el valor se limpia.
          value={props.valor ?? (props.opcionVacia ? NINGUNO : '')}
          onValueChange={(v) => props.alCambiar(v === NINGUNO ? null : v)}
          disabled={props.deshabilitado}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={props.placeholder ?? 'Seleccione'} />
          </SelectTrigger>
          <SelectContent>
            {props.opcionVacia ? <SelectItem value={NINGUNO}>{props.opcionVacia}</SelectItem> : null}
            {props.opciones.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

/** Año académico por defecto: el primero "abierto" (o el más reciente). */
export function useAnioSeleccionado() {
  const anios = useCatalogo('anios');
  const [anioId, setAnioId] = useState<string | null>(null);
  useEffect(() => {
    if (anioId || !anios.data?.length) return;
    const abierto = anios.data.find((a) => a.extra?.estado === 'abierto') ?? anios.data[0];
    if (abierto) setAnioId(abierto.valor);
  }, [anios.data, anioId]);
  return { anios, anioId, setAnioId };
}

export function SelectorAnio(props: { anios: { data?: Opcion[]; isPending: boolean }; anioId: string | null; alCambiar: (v: string | null) => void }) {
  return <SelectorCampo etiqueta="Año académico" valor={props.anioId} alCambiar={props.alCambiar} opciones={props.anios.data ?? []} cargando={props.anios.isPending} />;
}

export function SelectorSeccion(props: { anioId: string | null; valor: string | null; alCambiar: (v: string | null) => void; opcionVacia?: string }) {
  const secciones = useCatalogo('secciones', { anioId: props.anioId ?? undefined }, Boolean(props.anioId));
  return (
    <SelectorCampo
      etiqueta="Sección"
      valor={props.valor}
      alCambiar={props.alCambiar}
      opciones={secciones.data ?? []}
      cargando={Boolean(props.anioId) && secciones.isPending}
      deshabilitado={!props.anioId}
      opcionVacia={props.opcionVacia}
    />
  );
}

export function SelectorBimestre(props: { anioId: string | null; valor: string | null; alCambiar: (v: string | null) => void; opcionVacia?: string }) {
  const bimestres = useCatalogo('bimestres', { anioId: props.anioId ?? undefined }, Boolean(props.anioId));
  return (
    <SelectorCampo
      etiqueta="Bimestre"
      valor={props.valor}
      alCambiar={props.alCambiar}
      opciones={bimestres.data ?? []}
      cargando={Boolean(props.anioId) && bimestres.isPending}
      deshabilitado={!props.anioId}
      opcionVacia={props.opcionVacia}
    />
  );
}

/** Bimestre por defecto: el que contiene la fecha de hoy o el último ya iniciado. */
export function bimestrePorDefecto(opciones: Opcion[] | undefined, hoy: string): string | null {
  if (!opciones?.length) return null;
  const actual = opciones.find((b) => String(b.extra?.inicio ?? '') <= hoy && hoy <= String(b.extra?.fin ?? ''));
  if (actual) return actual.valor;
  const iniciados = opciones.filter((b) => String(b.extra?.inicio ?? '') <= hoy);
  return (iniciados.at(-1) ?? opciones[0])?.valor ?? null;
}
