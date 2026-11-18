'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CampoArea } from '@/components/formularios/campos';
import { api, mensajeDeError } from '@/lib/api';
import { MAX_BYTES_EVIDENCIA, MIME_EVIDENCIA } from '@/esquemas/asistencia/justificaciones';

const esquema = z.object({
  motivo: z.string().trim().min(5, 'Describa el motivo (mínimo 5 caracteres)').max(1000, 'Máximo 1000 caracteres'),
});

/** Solicitud de justificación con motivo y evidencia opcional (PDF o imagen, hasta 5 MB). */
export function DialogoJustificacion(props: {
  endpoint: string;
  asistenciaId: string | null;
  descripcion?: ReactNode;
  alCerrar: () => void;
  alEnviar?: () => Promise<unknown> | void;
}) {
  const abierto = props.asistenciaId !== null;
  const form = useForm<z.infer<typeof esquema>>({ resolver: zodResolver(esquema), defaultValues: { motivo: '' } });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      form.reset({ motivo: '' });
      setArchivo(null);
      setErrorArchivo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && props.alCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar justificación</DialogTitle>
          <DialogDescription>{props.descripcion ?? 'La revisará la institución. Puede adjuntar una constancia o certificado.'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit(async (d) => {
              if (errorArchivo) return;
              try {
                const fd = new FormData();
                fd.set('asistenciaId', props.asistenciaId ?? '');
                fd.set('motivo', d.motivo);
                if (archivo) fd.set('archivo', archivo);
                await api.post(props.endpoint, fd);
                toast.success('Solicitud enviada');
                await props.alEnviar?.();
                props.alCerrar();
              } catch (e) {
                toast.error(mensajeDeError(e));
              }
            })}
          >
            <CampoArea nombre="motivo" etiqueta="Motivo" filas={4} placeholder="Ej.: cita médica, duelo familiar…" />
            <div className="grid gap-1.5">
              <Label htmlFor="evidencia-justificacion">
                <Paperclip className="size-4" aria-hidden /> Evidencia (opcional)
              </Label>
              <Input
                id="evidencia-justificacion"
                type="file"
                accept={MIME_EVIDENCIA.join(',')}
                aria-describedby="ayuda-evidencia"
                aria-invalid={errorArchivo ? true : undefined}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setArchivo(f);
                  if (f && !(MIME_EVIDENCIA as readonly string[]).includes(f.type)) setErrorArchivo('Adjunte un PDF o una imagen (PNG, JPG o WebP)');
                  else if (f && f.size > MAX_BYTES_EVIDENCIA) setErrorArchivo('El archivo supera 5 MB');
                  else setErrorArchivo(null);
                }}
              />
              <p id="ayuda-evidencia" className={errorArchivo ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}>
                {errorArchivo ?? 'PDF o imagen, máximo 5 MB. Comparta solo lo necesario (p. ej., sin diagnóstico detallado).'}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={props.alCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || Boolean(errorArchivo)}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Enviar solicitud
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
