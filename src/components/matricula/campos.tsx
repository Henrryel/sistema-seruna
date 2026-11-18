'use client';
import { useState, type ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search, UserRound, X } from 'lucide-react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CampoSelect } from '@/components/formularios/campos';
import { Etiqueta } from '@/components/datos/badges';
import { api, conConsulta } from '@/lib/api';
import { useCatalogo, type TipoCatalogo } from '@/lib/catalogos';
import type { RespuestaListado } from '@/esquemas/comunes';
import type { FilaEstudiante } from '@/esquemas/matricula/estudiantes';
import { ENDPOINTS, useDebounce } from './utilidades';

/** Input de archivo para React Hook Form (el valor es el File seleccionado). */
export function CampoArchivo(props: { nombre: string; etiqueta: string; descripcion?: ReactNode; aceptar?: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.etiqueta}</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept={props.aceptar ?? 'application/pdf,image/png,image/jpeg,image/webp'}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
            />
          </FormControl>
          <FormDescription>{props.descripcion ?? 'PDF o imagen, máximo 15 MB.'}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Select alimentado por /api/catalogos/[tipo]. */
export function CampoCatalogo(props: {
  nombre: string;
  etiqueta: string;
  tipo: TipoCatalogo;
  params?: Record<string, string | undefined | null>;
  /** false = no consulta (p. ej. falta un filtro previo). */
  habilitado?: boolean;
  /** Muestra el valor pero no permite cambiarlo. */
  deshabilitado?: boolean;
  descripcion?: ReactNode;
  className?: string;
}) {
  const c = useCatalogo(props.tipo, props.params ?? {}, props.habilitado ?? true);
  return (
    <CampoSelect
      nombre={props.nombre}
      etiqueta={props.etiqueta}
      opciones={c.data ?? []}
      placeholder={c.isFetching ? 'Cargando…' : props.habilitado === false ? 'Seleccione primero el filtro anterior' : 'Seleccione'}
      deshabilitado={props.habilitado === false || props.deshabilitado}
      descripcion={props.descripcion}
      className={props.className}
    />
  );
}

/** Buscador de estudiantes (código, nombre o documento). */
export function BuscadorEstudiante(props: {
  valor: { id: string; etiqueta: string } | null;
  alCambiar: (v: { id: string; etiqueta: string } | null) => void;
  etiquetaAria?: string;
  invalido?: boolean;
}) {
  const [q, setQ] = useState('');
  const qd = useDebounce(q.trim());
  const consulta = useQuery({
    queryKey: ['buscar-estudiantes', qd],
    queryFn: () => api.get<RespuestaListado<FilaEstudiante>>(conConsulta(ENDPOINTS.estudiantes, { q: qd, porPagina: 8 })),
    enabled: qd.length >= 2,
  });
  if (props.valor) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{props.valor.etiqueta}</span>
        </span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar estudiante" onClick={() => props.alCambiar(null)}>
          <X aria-hidden />
        </Button>
      </div>
    );
  }
  const filas = consulta.data?.filas ?? [];
  return (
    <div className="grid gap-1">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Código, apellidos o DNI…"
          className="pl-8"
          aria-label={props.etiquetaAria ?? 'Buscar estudiante'}
          aria-invalid={props.invalido || undefined}
        />
        {consulta.isFetching ? <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      {qd.length >= 2 && !consulta.isFetching ? (
        <ul className="max-h-56 overflow-y-auto rounded-md border" role="listbox" aria-label="Resultados">
          {filas.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</li> : null}
          {filas.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => {
                  props.alCambiar({ id: f.id, etiqueta: `${f.apellidos}, ${f.nombres} (${f.codigo})` });
                  setQ('');
                }}
              >
                <span className="font-medium">
                  {f.apellidos}, {f.nombres}
                </span>
                <span className="text-xs text-muted-foreground">
                  {f.codigo}
                  {f.documento ? ` · ${f.documento}` : ''}
                  {f.ultima_matricula ? ` · ${f.ultima_matricula}` : ''}
                  {!f.activo ? ' · inactivo' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Campo de formulario con el buscador de estudiantes (guarda el id). */
export function CampoEstudiante(props: { nombre: string; etiqueta: string; inicial?: { id: string; etiqueta: string } | null }) {
  const { control } = useFormContext();
  const [seleccion, setSeleccion] = useState(props.inicial ?? null);
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>{props.etiqueta}</FormLabel>
          <BuscadorEstudiante
            valor={field.value && seleccion?.id === field.value ? seleccion : null}
            invalido={Boolean(fieldState.error)}
            etiquetaAria={props.etiqueta}
            alCambiar={(v) => {
              setSeleccion(v);
              field.onChange(v?.id ?? '');
            }}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function IconoOk() {
  return <Check className="size-4 text-exito-foreground" aria-hidden />;
}

export function EtiquetaBooleana({ valor, si = 'Sí', no = 'No' }: { valor: boolean; si?: string; no?: string }) {
  return <Etiqueta tono={valor ? 'exito' : 'neutro'}>{valor ? si : no}</Etiqueta>;
}
