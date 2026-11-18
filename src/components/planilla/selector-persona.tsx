'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { Check, Search } from 'lucide-react';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { OpcionPersona } from '@/esquemas/planilla/contratos';

/** Busca personas SIN perfil docente y guarda su id en el campo `nombre` del formulario. */
export function SelectorPersona({ nombre }: { nombre: string }) {
  const { control } = useFormContext();
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [elegida, setElegida] = useState<OpcionPersona | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const consulta = useQuery({
    queryKey: ['planilla', 'personas', busqueda],
    queryFn: () =>
      api.get<{ personas: OpcionPersona[] }>(conConsulta('/api/admin/planilla/personas', { q: busqueda })),
    enabled: busqueda.length >= 2,
  });

  return (
    <FormField
      control={control}
      name={nombre}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Persona</FormLabel>
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <FormControl>
              <Input
                className="pl-8"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Apellidos, nombres o DNI…"
                aria-controls="resultados-persona"
                autoComplete="off"
              />
            </FormControl>
          </div>
          <FormDescription>
            {elegida && field.value === elegida.id
              ? `Seleccionada: ${elegida.apellidos}, ${elegida.nombres}${elegida.dni ? ` · DNI ${elegida.dni}` : ''}`
              : 'Solo se listan personas que aún no tienen perfil docente.'}
          </FormDescription>
          <div id="resultados-persona" aria-live="polite">
            {busqueda.length < 2 ? null : consulta.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : consulta.isError ? (
              <p className="text-destructive text-sm">{mensajeDeError(consulta.error)}</p>
            ) : (consulta.data?.personas.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">Sin coincidencias.</p>
            ) : (
              <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-1" role="list">
                {consulta.data?.personas.map((p) => {
                  const activa = field.value === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-pressed={activa}
                        onClick={() => {
                          field.onChange(p.id);
                          setElegida(p);
                        }}
                        className={cn(
                          'hover:bg-accent focus-visible:ring-ring flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none',
                          activa && 'bg-accent font-medium',
                        )}
                      >
                        <span>
                          {p.apellidos}, {p.nombres}
                          {p.dni ? <span className="text-muted-foreground"> · DNI {p.dni}</span> : null}
                        </span>
                        {activa ? <Check className="size-4" aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
