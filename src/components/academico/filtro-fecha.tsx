import { CalendarSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Filtro de fecha por GET (funciona sin JavaScript): muestra el horario vigente en esa fecha. */
export function FiltroFecha({ fecha, etiqueta = 'Vigente al' }: { fecha: string; etiqueta?: string }) {
  return (
    <form method="get" className="flex items-end gap-2" role="search" aria-label="Elegir fecha">
      <div className="grid gap-1">
        <label htmlFor="fecha-portal" className="text-xs text-muted-foreground">
          {etiqueta}
        </label>
        <Input id="fecha-portal" type="date" name="fecha" defaultValue={fecha} className="w-44" />
      </div>
      <Button type="submit" variant="outline">
        <CalendarSearch aria-hidden /> Ver
      </Button>
    </form>
  );
}

/** Lee ?fecha=AAAA-MM-DD de los searchParams (o undefined si no es válida). */
export function fechaDeParametro(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined;
}
