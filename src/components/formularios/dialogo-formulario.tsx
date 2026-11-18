'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm, type DefaultValues, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { ApiError, mensajeDeError } from '@/lib/api';

/**
 * Diálogo con formulario validado por el MISMO esquema Zod que usa el backend.
 * `alEnviar` normalmente llama a la API; los errores 422 de campos se muestran en el formulario.
 */
export function DialogoFormulario<T extends FieldValues>(props: {
  titulo: string;
  descripcion?: ReactNode;
  esquema: ZodType<T, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  valores: DefaultValues<T>;
  alEnviar: (datos: T) => Promise<unknown>;
  mensajeExito?: string;
  disparador?: ReactNode;
  abierto?: boolean;
  alCambiarAbierto?: (abierto: boolean) => void;
  textoEnviar?: string;
  ancho?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const abierto = props.abierto ?? abiertoInterno;
  const setAbierto = props.alCambiarAbierto ?? setAbiertoInterno;
  const form = useForm<T>({ resolver: zodResolver(props.esquema), defaultValues: props.valores });

  useEffect(() => {
    if (abierto) form.reset(props.valores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const ancho = props.ancho === 'lg' ? 'sm:max-w-2xl' : props.ancho === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-lg';

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {props.disparador ? <DialogTrigger asChild>{props.disparador}</DialogTrigger> : null}
      <DialogContent className={`max-h-[90dvh] overflow-y-auto ${ancho}`}>
        <DialogHeader>
          <DialogTitle>{props.titulo}</DialogTitle>
          {props.descripcion ? <DialogDescription>{props.descripcion}</DialogDescription> : null}
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit(async (datos) => {
              try {
                await props.alEnviar(datos);
                toast.success(props.mensajeExito ?? 'Guardado');
                setAbierto(false);
              } catch (e) {
                const campos = e instanceof ApiError ? (e.detalles as { campos?: Record<string, string[]> } | undefined)?.campos : undefined;
                if (campos) {
                  for (const [campo, mensajes] of Object.entries(campos)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    form.setError(campo as any, { message: mensajes[0] });
                  }
                }
                toast.error(mensajeDeError(e));
              }
            })}
          >
            {props.children}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {props.textoEnviar ?? 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
