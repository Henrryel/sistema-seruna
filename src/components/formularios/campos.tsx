'use client';
// Campos de formulario sobre shadcn/ui + React Hook Form (usar dentro de <Form {...form}>).
import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Base {
  nombre: string;
  etiqueta: string;
  descripcion?: ReactNode;
  deshabilitado?: boolean;
  className?: string;
}

export function CampoTexto(props: Base & { tipo?: 'text' | 'email' | 'tel' | 'password' | 'number' | 'date' | 'time' | 'month'; placeholder?: string; autoComplete?: string; paso?: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => (
        <FormItem className={props.className}>
          <FormLabel>{props.etiqueta}</FormLabel>
          <FormControl>
            <Input
              type={props.tipo ?? 'text'}
              placeholder={props.placeholder}
              autoComplete={props.autoComplete}
              step={props.paso}
              disabled={props.deshabilitado}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          {props.descripcion ? <FormDescription>{props.descripcion}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CampoArea(props: Base & { placeholder?: string; filas?: number }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => (
        <FormItem className={props.className}>
          <FormLabel>{props.etiqueta}</FormLabel>
          <FormControl>
            <Textarea rows={props.filas ?? 3} placeholder={props.placeholder} disabled={props.deshabilitado} {...field} value={field.value ?? ''} />
          </FormControl>
          {props.descripcion ? <FormDescription>{props.descripcion}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CampoSelect(props: Base & { opciones: { valor: string; etiqueta: string }[]; placeholder?: string }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => (
        <FormItem className={props.className}>
          <FormLabel>{props.etiqueta}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined} disabled={props.deshabilitado}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={props.placeholder ?? 'Seleccione'} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {props.opciones.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {props.descripcion ? <FormDescription>{props.descripcion}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CampoSwitch(props: Base) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => (
        <FormItem className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${props.className ?? ''}`}>
          <div>
            <FormLabel>{props.etiqueta}</FormLabel>
            {props.descripcion ? <FormDescription>{props.descripcion}</FormDescription> : null}
          </div>
          <FormControl>
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={props.deshabilitado} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
