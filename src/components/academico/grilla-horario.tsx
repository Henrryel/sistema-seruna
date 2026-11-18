import type { ReactNode } from 'react';
import { Clock, DoorOpen, UserRound, Users } from 'lucide-react';
import { EstadoVacio } from '@/components/datos/basicos';
import { formatoHora, NOMBRE_DIA_ISO } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { BloqueHorario } from '@/esquemas/academico/horarios';

// Grilla semanal de bloques (sirve en Server y Client Components). Mobile-first: un día por tarjeta,
// apiladas en móvil y en columnas desde pantallas medianas.

const COLUMNAS: Record<number, string> = { 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7' };
const ACENTOS = ['border-l-primary', 'border-l-info-foreground', 'border-l-exito-foreground', 'border-l-alerta-foreground', 'border-l-peligro-foreground'];

function acento(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACENTOS[h % ACENTOS.length];
}

export function GrillaHorario(props: {
  bloques: BloqueHorario[];
  /** Qué mostrar bajo la asignatura: el docente (horario de sección) o la sección (horario del docente). */
  detalle?: 'docente' | 'seccion';
  acciones?: (bloque: BloqueHorario) => ReactNode;
  vacio?: ReactNode;
  className?: string;
}) {
  if (props.bloques.length === 0) {
    return <>{props.vacio ?? <EstadoVacio titulo="Sin horario" descripcion="No hay bloques de horario vigentes para la fecha." />}</>;
  }
  const maxDia = Math.max(5, ...props.bloques.map((b) => b.dia_iso));
  const dias = Array.from({ length: maxDia }, (_, i) => i + 1);
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 md:grid-cols-3', COLUMNAS[maxDia], props.className)}>
      {dias.map((dia) => {
        const delDia = props.bloques.filter((b) => b.dia_iso === dia).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
        return (
          <section key={dia} aria-label={NOMBRE_DIA_ISO[dia]} className="min-w-0 rounded-lg border bg-card">
            <h3 className="border-b px-3 py-2 text-sm font-semibold">{NOMBRE_DIA_ISO[dia]}</h3>
            <ul className="grid gap-2 p-2">
              {delDia.length === 0 ? <li className="px-1 py-3 text-center text-xs text-muted-foreground">Sin clases</li> : null}
              {delDia.map((b) => (
                <li key={b.id} className={cn('rounded-md border border-l-4 bg-muted/40 p-2 text-sm', acento(b.asignatura))}>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    <Clock className="size-3" aria-hidden />
                    <span>
                      {formatoHora(b.hora_inicio)} – {formatoHora(b.hora_fin)}
                    </span>
                  </p>
                  <p className="mt-0.5 leading-tight font-medium break-words">{b.asignatura}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {props.detalle === 'seccion' ? <Users className="size-3 shrink-0" aria-hidden /> : <UserRound className="size-3 shrink-0" aria-hidden />}
                    <span className="truncate">{props.detalle === 'seccion' ? b.seccion : b.docente}</span>
                  </p>
                  {b.aula ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DoorOpen className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{b.aula}</span>
                    </p>
                  ) : null}
                  {props.acciones ? <div className="mt-1 flex justify-end gap-1">{props.acciones(b)}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
