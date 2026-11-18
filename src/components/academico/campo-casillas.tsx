'use client';
import { useId, type ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormDescription, FormField, FormItem, FormMessage } from '@/components/ui/form';

/** Grupo de casillas para React Hook Form (valor: arreglo de ids). */
export function CampoCasillas(props: {
  nombre: string;
  etiqueta: string;
  opciones: { valor: string; etiqueta: ReactNode; detalle?: ReactNode }[];
  descripcion?: ReactNode;
  vacio?: ReactNode;
}) {
  const { control } = useFormContext();
  const base = useId();
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => {
        const valor = (field.value as string[] | undefined) ?? [];
        return (
          <FormItem>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">{props.etiqueta}</legend>
              {props.opciones.length === 0 ? (props.vacio ?? <p className="text-sm text-muted-foreground">No hay opciones.</p>) : null}
              <ul className="grid max-h-80 gap-2 overflow-y-auto">
                {props.opciones.map((o) => {
                  const id = `${base}-${o.valor}`;
                  return (
                    <li key={o.valor} className="flex items-start gap-3 rounded-md border p-2">
                      <Checkbox
                        id={id}
                        checked={valor.includes(o.valor)}
                        onCheckedChange={(v) => field.onChange(v ? [...valor, o.valor] : valor.filter((x) => x !== o.valor))}
                      />
                      <div className="grid gap-0.5 text-sm">
                        <Label htmlFor={id} className="leading-snug font-normal">
                          {o.etiqueta}
                        </Label>
                        {o.detalle ? <span className="text-xs text-muted-foreground">{o.detalle}</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            {props.descripcion ? <FormDescription>{props.descripcion}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
