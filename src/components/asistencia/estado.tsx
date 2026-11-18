'use client';
import { cn } from '@/lib/utils';
import { ESTADOS_MANUALES, ETIQUETA_ESTADO, type EstadoManual } from '@/esquemas/asistencia/registro';

const ESTILO: Record<EstadoManual, { activo: string; letra: string }> = {
  presente: { activo: 'bg-exito text-exito-foreground border-exito-foreground/40', letra: 'P' },
  tarde: { activo: 'bg-alerta text-alerta-foreground border-alerta-foreground/40', letra: 'T' },
  ausente: { activo: 'bg-peligro text-peligro-foreground border-peligro-foreground/40', letra: 'A' },
};

/**
 * Selector presente / tarde / ausente (botones conmutables con texto, no solo color).
 * "justificado" no se elige a mano: lo pone la base al aprobar una justificación.
 */
export function SelectorEstado(props: {
  valor: string;
  alCambiar: (estado: EstadoManual) => void;
  deshabilitado?: boolean;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={props.etiqueta} className="inline-flex gap-1">
      {ESTADOS_MANUALES.map((e) => {
        const activo = props.valor === e;
        return (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={props.deshabilitado}
            onClick={() => props.alCambiar(e)}
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border px-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50',
              activo ? ESTILO[e].activo : 'bg-background hover:bg-accent',
            )}
            title={ETIQUETA_ESTADO[e]}
          >
            <span aria-hidden className="sm:hidden">
              {ESTILO[e].letra}
            </span>
            <span className="sr-only sm:not-sr-only">{ETIQUETA_ESTADO[e]}</span>
          </button>
        );
      })}
    </div>
  );
}
