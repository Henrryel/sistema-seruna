'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface OpcionBusqueda {
  valor: string;
  etiqueta: string;
}

/**
 * Selector con búsqueda en el servidor (matrículas, personas…). `url(q)` construye el endpoint que responde
 * `{ opciones: OpcionBusqueda[] }`; con `minimo` caracteres se dispara la consulta.
 */
export function ComboBusqueda(props: {
  id?: string;
  valor: string | null | undefined;
  etiqueta?: string | null;
  alCambiar: (opcion: OpcionBusqueda | null) => void;
  url: (q: string) => string | null;
  placeholder?: string;
  minimo?: number;
  deshabilitado?: boolean;
  invalido?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const minimo = props.minimo ?? 0;
  const url = qDebounced.length >= minimo ? props.url(qDebounced) : null;
  const consulta = useQuery({
    queryKey: ['combo-busqueda', url],
    queryFn: () => api.get<{ opciones: OpcionBusqueda[] }>(url as string),
    enabled: abierto && Boolean(url),
    staleTime: 30_000,
  });

  return (
    <div className="flex gap-1">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            id={props.id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={abierto}
            aria-invalid={props.invalido || undefined}
            disabled={props.deshabilitado}
            className="w-full min-w-0 justify-between font-normal"
          >
            <span className={cn('truncate', !props.valor && 'text-muted-foreground')}>{props.valor ? (props.etiqueta ?? props.valor) : (props.placeholder ?? 'Buscar…')}</span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={q} onValueChange={setQ} placeholder={minimo ? `Escriba al menos ${minimo} letras…` : 'Buscar…'} />
            <CommandList>
              {consulta.isFetching ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando…
                </div>
              ) : null}
              {!consulta.isFetching && url ? <CommandEmpty>Sin resultados</CommandEmpty> : null}
              <CommandGroup>
                {(consulta.data?.opciones ?? []).map((o) => (
                  <CommandItem
                    key={o.valor}
                    value={o.valor}
                    onSelect={() => {
                      props.alCambiar(o);
                      setAbierto(false);
                    }}
                  >
                    <Check className={cn('size-4', props.valor === o.valor ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    <span className="truncate">{o.etiqueta}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {props.valor && !props.deshabilitado ? (
        <Button type="button" variant="ghost" size="icon" aria-label="Quitar selección" onClick={() => props.alCambiar(null)}>
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
