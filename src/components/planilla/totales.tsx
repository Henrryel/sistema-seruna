import { cn } from '@/lib/utils';
import { formatoMoneda } from '@/lib/formato';
import { textoMinutos } from '@/esquemas/planilla/horas';
import type { Totales } from '@/esquemas/planilla/liquidaciones';

/** Totales de una liquidación (vista `saldos_liquidacion_docente`). */
export function TotalesLiquidacion({
  totales,
  porHoras,
  className,
}: {
  totales: Totales;
  porHoras: boolean;
  className?: string;
}) {
  const filas: { etiqueta: string; valor: string; destacado?: boolean }[] = [
    {
      etiqueta: porHoras ? `Base (${textoMinutos(totales.minutos_aprobados)})` : 'Base',
      valor: formatoMoneda(totales.base),
    },
    { etiqueta: '(+) Adicionales', valor: formatoMoneda(totales.adicionales) },
    { etiqueta: '(−) Descuentos', valor: formatoMoneda(totales.descuentos) },
    { etiqueta: 'Neto', valor: formatoMoneda(totales.neto), destacado: true },
    { etiqueta: 'Pagado', valor: formatoMoneda(totales.abonado) },
    {
      etiqueta: 'Saldo',
      valor: totales.saldo === null ? 'Al aprobar' : formatoMoneda(totales.saldo),
      destacado: true,
    },
  ];
  return (
    <dl className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)}>
      {filas.map((f) => (
        <div key={f.etiqueta} className={cn('rounded-lg border p-2', f.destacado && 'bg-muted/50')}>
          <dt className="text-muted-foreground text-xs">{f.etiqueta}</dt>
          <dd className={cn('tabular-nums', f.destacado ? 'text-base font-semibold' : 'text-sm font-medium')}>
            {f.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
