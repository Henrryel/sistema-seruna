'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, FileDown, FileSpreadsheet, RotateCcw, Undo2, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablaDatos } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio, Indicador } from '@/components/datos/basicos';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoMoneda, hoyLima } from '@/lib/formato';
import { descripcionCuota } from '@/esquemas/cobros/cuotas';
import { OPCIONES_CONCEPTO } from '@/esquemas/cobros/planes';
import { ETIQUETA_MEDIO } from '@/esquemas/cobros/pagos';
import type { FilaMorosidad, Recaudacion, ResumenMorosidad } from '@/esquemas/cobros/reportes';
import { aCentimos, sumar } from '@/esquemas/cobros/dinero';

const API = '/api/admin/cobros/reportes';
const TODOS = '__todos__';

export function ClienteReportesCobros() {
  return (
    <>
      <EncabezadoPagina titulo="Morosidad y recaudación" descripcion="La morosidad se calcula con la función de la base reporte_cuotas_al_corte (importe + ajustes − abonos netos al corte)." />
      <Tabs defaultValue="morosidad">
        <TabsList>
          <TabsTrigger value="morosidad">Morosidad al corte</TabsTrigger>
          <TabsTrigger value="recaudacion">Recaudación</TabsTrigger>
        </TabsList>
        <TabsContent value="morosidad" className="mt-4">
          <Morosidad />
        </TabsContent>
        <TabsContent value="recaudacion" className="mt-4">
          <RecaudacionPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

function SelectFiltro(props: { id: string; etiqueta: string; valor: string; alCambiar: (v: string) => void; opciones: { valor: string; etiqueta: string }[]; todos?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id} className="text-xs">
        {props.etiqueta}
      </Label>
      <Select value={props.valor || TODOS} onValueChange={(v) => props.alCambiar(v === TODOS ? '' : v)}>
        <SelectTrigger id={props.id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.todos !== false ? <SelectItem value={TODOS}>Todos</SelectItem> : null}
          {props.opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Morosidad() {
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  const porDefecto = (anios.data ?? []).find((a) => a.extra?.estado === 'abierto')?.valor ?? anios.data?.[0]?.valor ?? '';
  const [anioId, setAnioId] = useState('');
  useEffect(() => {
    if (!anioId && porDefecto) setAnioId(porDefecto);
  }, [anioId, porDefecto]);
  const [corte, setCorte] = useState(hoyLima());
  const [gradoId, setGradoId] = useState('');
  const [seccionId, setSeccionId] = useState('');
  const [concepto, setConcepto] = useState('');
  const [soloVencidas, setSoloVencidas] = useState(true);
  const secciones = useCatalogo('secciones', { anioId, gradoId: gradoId || undefined }, Boolean(anioId));

  const parametros = useMemo(
    () => ({ anioId, corte, gradoId: gradoId || undefined, seccionId: seccionId || undefined, concepto: concepto || undefined, soloVencidas: String(soloVencidas) }),
    [anioId, corte, gradoId, seccionId, concepto, soloVencidas],
  );
  const resumen = useQuery({
    queryKey: ['cobros', 'morosidad-resumen', parametros],
    queryFn: () => api.get<ResumenMorosidad>(conConsulta(`${API}/morosidad/resumen`, parametros)),
    enabled: Boolean(anioId && corte),
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-6">
          <SelectFiltro id="mor-anio" etiqueta="Año" valor={anioId} alCambiar={setAnioId} opciones={anios.data ?? []} todos={false} />
          <div className="grid gap-1.5">
            <Label htmlFor="mor-corte" className="text-xs">
              Fecha de corte
            </Label>
            <Input id="mor-corte" type="date" value={corte} onChange={(e) => setCorte(e.target.value)} />
          </div>
          <SelectFiltro
            id="mor-grado"
            etiqueta="Grado"
            valor={gradoId}
            alCambiar={(v) => {
              setGradoId(v);
              setSeccionId('');
            }}
            opciones={grados.data ?? []}
          />
          <SelectFiltro id="mor-seccion" etiqueta="Sección" valor={seccionId} alCambiar={setSeccionId} opciones={secciones.data ?? []} />
          <SelectFiltro id="mor-concepto" etiqueta="Concepto" valor={concepto} alCambiar={setConcepto} opciones={OPCIONES_CONCEPTO} />
          <div className="flex items-end justify-between gap-2 rounded-md border px-3 py-2">
            <Label htmlFor="mor-vencidas" className="text-xs">
              Solo vencidas
            </Label>
            <Switch id="mor-vencidas" checked={soloVencidas} onCheckedChange={setSoloVencidas} />
          </div>
        </CardContent>
      </Card>

      {!anioId ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador
              titulo="Saldo vencido"
              valor={resumen.data ? formatoMoneda(resumen.data.vencido) : <Skeleton className="h-8 w-24" />}
              icono={<AlertTriangle className="size-4" aria-hidden />}
              detalle={`Al ${formatoFecha(corte)}`}
            />
            <Indicador titulo="Saldo total pendiente" valor={resumen.data ? formatoMoneda(resumen.data.saldo) : <Skeleton className="h-8 w-24" />} icono={<Wallet className="size-4" aria-hidden />} />
            <Indicador titulo={soloVencidas ? 'Alumnos morosos' : 'Alumnos con saldo'} valor={resumen.data?.alumnos ?? '—'} icono={<Users className="size-4" aria-hidden />} />
            <Indicador titulo="Cuotas listadas" valor={resumen.data?.cuotas ?? '—'} />
          </div>
          {resumen.isError ? (
            <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
              {mensajeDeError(resumen.error)}
            </p>
          ) : null}
          <TablaDatos<FilaMorosidad>
            endpoint={`${API}/morosidad`}
            parametros={parametros}
            claveFila={(f) => f.cuota_id}
            placeholderBusqueda="Buscar alumno o código…"
            porPagina={50}
            vacio={<EstadoVacio titulo="Sin deuda" descripcion="No hay cuotas con saldo para los filtros y la fecha de corte." />}
            columnas={[
              {
                clave: 'alumno',
                titulo: 'Alumno',
                celda: (f) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.alumno}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.codigo} · {f.grado}
                      {f.seccion ? ` "${f.seccion}"` : ''}
                    </p>
                  </div>
                ),
              },
              { clave: 'cuota', titulo: 'Cuota', celda: (f) => descripcionCuota(f) },
              { clave: 'vence_en', titulo: 'Vence', celda: (f) => formatoFecha(f.vence_en), ocultarEnMovil: true },
              {
                clave: 'dias_atraso',
                titulo: 'Atraso',
                celda: (f) => (f.dias_atraso > 0 ? <Etiqueta tono={f.dias_atraso > 60 ? 'peligro' : 'alerta'}>{f.dias_atraso} días</Etiqueta> : <Etiqueta>Por vencer</Etiqueta>),
              },
              { clave: 'importe', titulo: 'Importe', celda: (f) => formatoMoneda(f.importe), className: 'text-right', ocultarEnMovil: true },
              { clave: 'abonado', titulo: 'Abonado', celda: (f) => formatoMoneda(f.abonado), className: 'text-right', ocultarEnMovil: true },
              { clave: 'saldo', titulo: 'Saldo', celda: (f) => <span className="font-semibold tabular-nums">{formatoMoneda(f.saldo)}</span>, className: 'text-right' },
            ]}
          />
        </>
      )}
    </div>
  );
}

function primerDiaDelMes(fecha: string) {
  return `${fecha.slice(0, 7)}-01`;
}

function RecaudacionPanel() {
  const hoy = hoyLima();
  const [desde, setDesde] = useState(primerDiaDelMes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const valido = Boolean(desde && hasta && hasta >= desde);
  const consulta = useQuery({
    queryKey: ['cobros', 'recaudacion', desde, hasta],
    queryFn: () => api.get<Recaudacion>(conConsulta(`${API}/recaudacion`, { desde, hasta })),
    enabled: valido,
  });
  const d = consulta.data;
  const diasConMovimiento = (d?.porDia ?? []).filter((x) => x.pagos > 0 || aCentimos(x.revertido) > 0 || aCentimos(x.devuelto) > 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="rec-desde" className="text-xs">
            Desde
          </Label>
          <Input id="rec-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rec-hasta" className="text-xs">
            Hasta
          </Label>
          <Input id="rec-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" asChild disabled={!valido}>
            <a href={conConsulta(`${API}/recaudacion`, { desde, hasta, formato: 'xlsx' })} download>
              <FileSpreadsheet aria-hidden /> Excel
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild disabled={!valido}>
            <a href={conConsulta(`${API}/recaudacion`, { desde, hasta, formato: 'pdf' })} download>
              <FileDown aria-hidden /> PDF
            </a>
          </Button>
        </div>
      </div>
      {!valido ? <p className="text-sm text-peligro-foreground">El rango de fechas es inválido.</p> : null}
      {consulta.isError ? (
        <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          {mensajeDeError(consulta.error)}
        </p>
      ) : null}
      {consulta.isPending && valido ? (
        <Skeleton className="h-64 w-full" />
      ) : d ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador titulo="Cobrado" valor={formatoMoneda(d.totales.cobrado)} detalle={`${d.totales.pagos} pago(s)`} icono={<Banknote className="size-4" aria-hidden />} />
            <Indicador titulo="Revertido" valor={formatoMoneda(d.totales.revertido)} icono={<RotateCcw className="size-4" aria-hidden />} />
            <Indicador titulo="Devuelto" valor={formatoMoneda(d.totales.devuelto)} icono={<Undo2 className="size-4" aria-hidden />} />
            <Indicador titulo="Neto" valor={formatoMoneda(d.totales.neto)} icono={<Wallet className="size-4" aria-hidden />} className="border-primary/40" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por medio de pago</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {d.porMedio.map((m) => {
                    const total = aCentimos(d.totales.cobrado);
                    const pct = total > 0 ? Math.round((aCentimos(m.importe) * 100) / total) : 0;
                    return (
                      <li key={m.medio} className="grid gap-1">
                        <div className="flex justify-between">
                          <span>
                            {ETIQUETA_MEDIO[m.medio]} <span className="text-xs text-muted-foreground">({m.pagos})</span>
                          </span>
                          <span className="font-medium tabular-nums">{formatoMoneda(m.importe)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por día</CardTitle>
              </CardHeader>
              <CardContent>
                {diasConMovimiento.length === 0 ? (
                  <EstadoVacio titulo="Sin movimientos" descripcion="No hay pagos en el rango seleccionado." />
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Pagos</TableHead>
                          <TableHead className="hidden text-right md:table-cell">Efectivo</TableHead>
                          <TableHead className="hidden text-right md:table-cell">Transf./Yape/Plin</TableHead>
                          <TableHead className="hidden text-right md:table-cell">Tarjeta/otro</TableHead>
                          <TableHead className="text-right">Cobrado</TableHead>
                          <TableHead className="text-right">Neto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diasConMovimiento.map((x) => (
                          <TableRow key={x.fecha}>
                            <TableCell>{formatoFecha(x.fecha)}</TableCell>
                            <TableCell className="text-right">{x.pagos}</TableCell>
                            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatoMoneda(x.efectivo)}</TableCell>
                            <TableCell className="hidden text-right tabular-nums md:table-cell">
                              {formatoMoneda(sumar(x.transferencia, x.yape, x.plin))}
                            </TableCell>
                            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatoMoneda(sumar(x.tarjeta, x.otro))}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatoMoneda(x.cobrado)}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatoMoneda(x.neto)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
