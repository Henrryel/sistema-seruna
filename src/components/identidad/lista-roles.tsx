'use client';
import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { RolDisponible } from '@/esquemas/identidad/usuarios';

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<{ roles: RolDisponible[] }>('/api/admin/identidad/roles')).roles,
    staleTime: 5 * 60_000,
  });
}

/** Casillas de roles con la cantidad de permisos que otorga cada uno. */
export function ListaRoles(props: { seleccion: string[]; alCambiar: (roles: string[]) => void; deshabilitado?: boolean }) {
  const roles = useRoles();
  const base = useId();
  if (roles.isPending) return <Skeleton className="h-28 w-full" />;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {(roles.data ?? []).map((r) => {
        const idCampo = `${base}-${r.codigo}`;
        const marcado = props.seleccion.includes(r.codigo);
        return (
          <li key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id={idCampo}
              checked={marcado}
              disabled={props.deshabilitado}
              onCheckedChange={(v) => props.alCambiar(v ? [...props.seleccion, r.codigo] : props.seleccion.filter((c) => c !== r.codigo))}
            />
            <div className="grid gap-0.5">
              <Label htmlFor={idCampo}>{r.nombre}</Label>
              <p className="text-xs text-muted-foreground" title={r.permisos.join(', ')}>
                {r.permisos.length} permiso(s)
                {r.permisos.length > 0 && r.permisos.length <= 4 ? `: ${r.permisos.join(', ')}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** ListaRoles integrada con React Hook Form (valor: arreglo de códigos de rol). */
export function CampoRoles({ nombre, etiqueta }: { nombre: string; etiqueta: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={nombre}
      render={({ field }) => (
        <FormItem>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{etiqueta}</legend>
            <ListaRoles seleccion={(field.value as string[] | undefined) ?? []} alCambiar={field.onChange} />
          </fieldset>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
