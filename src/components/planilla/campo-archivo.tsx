'use client';
import { useId, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const MAX_BYTES = 15 * 1024 * 1024;
const ACEPTADOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

/**
 * Adjunto opcional (PDF o imagen, máx. 15 MB) fuera del formulario RHF: el archivo viaja en multipart
 * junto con los datos para quedar en la misma transacción que el registro.
 */
export function CampoArchivo(props: {
  etiqueta: string;
  descripcion?: string;
  archivo: File | null;
  alCambiar: (archivo: File | null) => void;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{props.etiqueta}</Label>
      {props.archivo ? (
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="truncate">{props.archivo.name}</span>
            <span className="text-muted-foreground shrink-0">
              ({Math.ceil(props.archivo.size / 1024)} KB)
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar archivo"
            onClick={() => props.alCambiar(null)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Input
          id={id}
          type="file"
          accept={ACEPTADOS.join(',')}
          aria-describedby={`${id}-ayuda`}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > MAX_BYTES) {
              setError('El archivo supera 15 MB');
              e.target.value = '';
              return;
            }
            if (f && !ACEPTADOS.includes(f.type)) {
              setError('Solo PDF o imágenes (PNG, JPG, WEBP)');
              e.target.value = '';
              return;
            }
            setError(null);
            props.alCambiar(f);
          }}
        />
      )}
      <p
        id={`${id}-ayuda`}
        className={error ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
        role={error ? 'alert' : undefined}
      >
        {error ?? props.descripcion ?? 'Opcional. PDF o imagen, máximo 15 MB.'}
      </p>
    </div>
  );
}

/** Cuerpo para `api.post/put`: JSON si no hay archivo; multipart (`datos` + `archivo`) si lo hay. */
export function cuerpoConArchivo(datos: unknown, archivo: File | null): unknown {
  if (!archivo) return datos;
  const form = new FormData();
  form.set('datos', JSON.stringify(datos));
  form.set('archivo', archivo);
  return form;
}

/** Enlace de descarga de un archivo de planilla (documento o evidencia). */
export const urlArchivo = (id: string) => `/api/admin/planilla/archivos/${id}`;
