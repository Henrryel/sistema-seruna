'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { api, conConsulta } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { RespuestaListado } from '@/esquemas/comunes';
import type { FilaPersona } from '@/esquemas/identidad/personas';

/** Campo de formulario para elegir una persona buscando por nombre o documento (búsqueda en el servidor). */
export function CampoPersona(props: {
  nombre: string;
  etiqueta: string;
  perfil?: 'sin_usuario' | 'con_usuario' | 'estudiante' | 'docente';
  etiquetaInicial?: string;
  descripcion?: string;
}) {
  const { control } = useFormContext();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [etiqueta, setEtiqueta] = useState(props.etiquetaInicial ?? '');

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);
  useEffect(() => setEtiqueta(props.etiquetaInicial ?? ''), [props.etiquetaInicial]);

  const consulta = useQuery({
    queryKey: ['personas-buscar', props.perfil, busqueda],
    queryFn: () =>
      api.get<RespuestaListado<FilaPersona>>(conConsulta('/api/admin/identidad/personas', { q: busqueda, perfil: props.perfil, porPagina: 15 })),
    enabled: abierto,
    staleTime: 10_000,
  });

  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{props.etiqueta}</FormLabel>
          <Popover open={abierto} onOpenChange={setAbierto}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button type="button" variant="outline" role="combobox" aria-expanded={abierto} className={cn('w-full justify-between font-normal', !field.value && 'text-muted-foreground')}>
                  <span className="truncate">{field.value ? etiqueta || 'Persona seleccionada' : 'Buscar por nombre o documento…'}</span>
                  <ChevronsUpDown className="opacity-50" aria-hidden />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Apellidos, nombres o DNI…" value={texto} onValueChange={setTexto} aria-label="Buscar persona" />
                <CommandList>
                  {consulta.isFetching ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando…
                    </div>
                  ) : null}
                  {!consulta.isFetching ? <CommandEmpty>No se encontraron personas.</CommandEmpty> : null}
                  <CommandGroup>
                    {(consulta.data?.filas ?? []).map((p) => {
                      const texto = `${p.apellidos}, ${p.nombres}`;
                      return (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          onSelect={() => {
                            field.onChange(p.id);
                            setEtiqueta(texto);
                            setAbierto(false);
                          }}
                        >
                          <Check className={cn('size-4', field.value === p.id ? 'opacity-100' : 'opacity-0')} aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate">{texto}</p>
                            {p.documentos ? <p className="truncate text-xs text-muted-foreground">{p.documentos}</p> : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {props.descripcion ? <FormDescription>{props.descripcion}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
