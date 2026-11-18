import type { ReactNode } from 'react';
import { Inbox, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Encabezado de página: título, descripción y acciones (se apilan en móvil). */
export function EncabezadoPagina(props: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', props.className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{props.titulo}</h2>
        {props.descripcion ? <p className="mt-1 text-sm text-muted-foreground">{props.descripcion}</p> : null}
      </div>
      {props.acciones ? <div className="flex flex-wrap gap-2">{props.acciones}</div> : null}
    </div>
  );
}

export function EstadoVacio(props: { titulo?: string; descripcion?: ReactNode; accion?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
      <div className="text-muted-foreground">{props.icono ?? <Inbox className="size-8" aria-hidden />}</div>
      <p className="font-medium">{props.titulo ?? 'No hay registros'}</p>
      {props.descripcion ? <p className="max-w-md text-sm text-muted-foreground">{props.descripcion}</p> : null}
      {props.accion}
    </div>
  );
}

export function SinPermiso({ mensaje }: { mensaje?: string }) {
  return (
    <EstadoVacio
      icono={<ShieldAlert className="size-8" aria-hidden />}
      titulo="Acceso restringido"
      descripcion={mensaje ?? 'No tiene permiso para ver esta sección.'}
    />
  );
}

/** Tarjeta de indicador (KPI). */
export function Indicador(props: { titulo: string; valor: ReactNode; detalle?: ReactNode; icono?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 text-card-foreground shadow-xs', props.className)}>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{props.titulo}</span>
        {props.icono}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{props.valor}</div>
      {props.detalle ? <div className="mt-1 text-xs text-muted-foreground">{props.detalle}</div> : null}
    </div>
  );
}
