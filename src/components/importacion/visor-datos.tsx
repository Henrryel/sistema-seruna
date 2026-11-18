'use client';
import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function texto(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** Vista breve de una fila cruda: primeras claves "clave: valor". */
export function VistaPreviaDatos({ datos, max = 3 }: { datos: Record<string, unknown>; max?: number }) {
  const entradas = Object.entries(datos);
  return (
    <span className="block max-w-xs truncate font-mono text-xs text-muted-foreground" title={JSON.stringify(datos)}>
      {entradas
        .slice(0, max)
        .map(([k, v]) => `${k}: ${texto(v)}`)
        .join(' · ')}
      {entradas.length > max ? ` · +${entradas.length - max}` : ''}
    </span>
  );
}

/** Diálogo con todos los campos de una fila del sistema anterior (solo lectura). */
export function VisorDatos({ titulo, descripcion, datos }: { titulo: string; descripcion?: string; datos: Record<string, unknown> }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ver datos de ${titulo}`}>
          <Eye aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
          {Object.entries(datos).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="truncate font-mono text-xs text-muted-foreground" title={k}>
                {k}
              </dt>
              <dd className="break-words">{texto(v)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
