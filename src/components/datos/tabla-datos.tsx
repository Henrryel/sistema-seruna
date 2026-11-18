'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EstadoVacio } from './basicos';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import type { RespuestaListado } from '@/esquemas/comunes';
import { cn } from '@/lib/utils';

export interface ColumnaTabla<F> {
  clave: string;
  titulo: string;
  celda?: (fila: F) => ReactNode;
  className?: string;
  /** Ocultar en pantallas pequeñas. */
  ocultarEnMovil?: boolean;
}

export interface FiltroTabla {
  nombre: string;
  etiqueta: string;
  tipo: 'select' | 'texto' | 'fecha';
  opciones?: { valor: string; etiqueta: string }[];
  /** Valor inicial. */
  valor?: string;
}

const TODOS = '__todos__';

/** Clave de TanStack Query de un listado (para invalidar tras mutaciones). */
export const claveListado = (endpoint: string) => ['listado', endpoint] as const;

export function useRecargarListado() {
  const qc = useQueryClient();
  return (endpoint: string) => qc.invalidateQueries({ queryKey: claveListado(endpoint) });
}

function useDebounce<T>(valor: T, ms = 350): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/**
 * Tabla de datos paginada en el servidor con búsqueda, filtros y exportación Excel/PDF
 * (el endpoint debe usar `responderListado` y aceptar `formato=xlsx|pdf` con los mismos filtros).
 */
export function TablaDatos<F>(props: {
  endpoint: string;
  columnas: ColumnaTabla<F>[];
  claveFila: (fila: F) => string;
  filtros?: FiltroTabla[];
  /** Parámetros fijos (p. ej. anioId) que se envían siempre. */
  parametros?: Record<string, string | number | undefined | null>;
  acciones?: (fila: F) => ReactNode;
  buscador?: boolean;
  placeholderBusqueda?: string;
  exportar?: boolean;
  porPagina?: number;
  vacio?: ReactNode;
  barra?: ReactNode;
  alSeleccionarFila?: (fila: F) => void;
}) {
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries((props.filtros ?? []).filter((f) => f.valor).map((f) => [f.nombre, f.valor as string])),
  );
  const qDebounced = useDebounce(q);
  const porPagina = props.porPagina ?? 20;

  // Se compara por contenido: un objeto `parametros` nuevo en cada render no reinicia la paginación.
  const clavePropias = JSON.stringify(props.parametros ?? {});
  const parametros = useMemo(
    () => ({ ...(JSON.parse(clavePropias) as Record<string, string | number | null>), ...valores, q: qDebounced || undefined }),
    [clavePropias, valores, qDebounced],
  );
  const claveParametros = JSON.stringify(parametros);

  useEffect(() => setPagina(1), [claveParametros]);

  const consulta = useQuery({
    queryKey: [...claveListado(props.endpoint), parametros, pagina, porPagina],
    queryFn: () => api.get<RespuestaListado<F>>(conConsulta(props.endpoint, { ...parametros, pagina, porPagina })),
    placeholderData: keepPreviousData,
  });

  const total = consulta.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const columnas = props.acciones ? [...props.columnas, { clave: '__acciones', titulo: 'Acciones', className: 'text-right' } as ColumnaTabla<F>] : props.columnas;

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {props.buscador !== false ? (
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={props.placeholderBusqueda ?? 'Buscar…'}
              className="pl-8"
              aria-label="Buscar"
            />
          </div>
        ) : null}
        {(props.filtros ?? []).map((f) => (
          <div key={f.nombre} className="w-full lg:w-48">
            {f.tipo === 'select' ? (
              <Select
                value={valores[f.nombre] ?? TODOS}
                onValueChange={(v) => setValores((s) => ({ ...s, [f.nombre]: v === TODOS ? '' : v }))}
              >
                <SelectTrigger className="w-full" aria-label={f.etiqueta}>
                  <SelectValue placeholder={f.etiqueta} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>{f.etiqueta}: todos</SelectItem>
                  {(f.opciones ?? []).map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={f.tipo === 'fecha' ? 'date' : 'text'}
                value={valores[f.nombre] ?? ''}
                onChange={(e) => setValores((s) => ({ ...s, [f.nombre]: e.target.value }))}
                aria-label={f.etiqueta}
                placeholder={f.etiqueta}
              />
            )}
          </div>
        ))}
        {Object.values(valores).some(Boolean) ? (
          <Button variant="ghost" size="sm" onClick={() => setValores({})}>
            <X aria-hidden /> Limpiar
          </Button>
        ) : null}
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {props.barra}
          {props.exportar !== false ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={conConsulta(props.endpoint, { ...parametros, formato: 'xlsx' })} download>
                  <FileSpreadsheet aria-hidden /> Excel
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={conConsulta(props.endpoint, { ...parametros, formato: 'pdf' })} download>
                  <FileDown aria-hidden /> PDF
                </a>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {consulta.isError ? (
        <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          {mensajeDeError(consulta.error)}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnas.map((c) => (
                <TableHead key={c.clave} className={cn(c.className, c.ocultarEnMovil && 'hidden md:table-cell')}>
                  {c.titulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {consulta.isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columnas.map((c) => (
                      <TableCell key={c.clave} className={cn(c.ocultarEnMovil && 'hidden md:table-cell')}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : (consulta.data?.filas ?? []).map((fila) => (
                  <TableRow
                    key={props.claveFila(fila)}
                    className={props.alSeleccionarFila ? 'cursor-pointer' : undefined}
                    onClick={props.alSeleccionarFila ? () => props.alSeleccionarFila?.(fila) : undefined}
                  >
                    {props.columnas.map((c) => (
                      <TableCell key={c.clave} className={cn(c.className, c.ocultarEnMovil && 'hidden md:table-cell')}>
                        {c.celda ? c.celda(fila) : String((fila as Record<string, unknown>)[c.clave] ?? '—')}
                      </TableCell>
                    ))}
                    {props.acciones ? (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">{props.acciones(fila)}</div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!consulta.isPending && (consulta.data?.filas.length ?? 0) === 0 ? (
          <div className="p-4">{props.vacio ?? <EstadoVacio descripcion="Ajuste la búsqueda o los filtros." />}</div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {total} registro(s){consulta.isFetching && !consulta.isPending ? ' · actualizando…' : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} aria-label="Página anterior">
            <ChevronLeft aria-hidden />
          </Button>
          <span>
            {pagina} / {paginas}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setPagina((p) => Math.min(paginas, p + 1))} disabled={pagina >= paginas} aria-label="Página siguiente">
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
