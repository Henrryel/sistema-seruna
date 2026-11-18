'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, FileDown, Receipt, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BadgeEstadoPago, Etiqueta, estadoPago, type EstadoPago } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio, Indicador } from '@/components/datos/basicos';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora, formatoMoneda } from '@/lib/formato';
import { descripcionCuota } from '@/esquemas/cobros/cuotas';
import { ETIQUETA_MEDIO, type CuotaConSaldo } from '@/esquemas/cobros/pagos';
import type { EstadoCuenta } from '@/esquemas/cobros/reportes';
import { aCentimos, sumar } from '@/esquemas/cobros/dinero';
import { cn } from '@/lib/utils';

const PUNTO: Record<EstadoPago, string> = {
  pagado: 'bg-exito-foreground',
  parcial: 'bg-info-foreground',
  pendiente: 'bg-alerta-foreground',
  vencido: 'bg-peligro-foreground',
};

function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="Leyenda del semáforo">
      {(['pagado', 'parcial', 'pendiente', 'vencido'] as const).map((e) => (
        <li key={e}>
          <BadgeEstadoPago estado={e} />
        </li>
      ))}
    </ul>
  );
}

function TablaCuotas({ cuotas, hoy }: { cuotas: CuotaConSaldo[]; hoy: string }) {
  return (
    <>
      {/* Móvil: tarjetas */}
      <ul className="grid gap-2 md:hidden">
        {cuotas.map((c) => (
          <li key={c.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{descripcionCuota(c)}</p>
                <p className="text-xs text-muted-foreground">Vence {formatoFecha(c.vence_en)}</p>
              </div>
              <BadgeEstadoPago estado={estadoPago(c, hoy)} />
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
              <div>
                <dt className="text-muted-foreground">Importe</dt>
                <dd className="tabular-nums">{formatoMoneda(sumar(c.importe, c.ajustes))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pagado</dt>
                <dd className="tabular-nums">{formatoMoneda(c.abonado)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Saldo</dt>
                <dd className="font-semibold tabular-nums">{formatoMoneda(c.saldo)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuota</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="text-right">Descuentos</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuotas.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{descripcionCuota(c)}</TableCell>
                <TableCell>{formatoFecha(c.vence_en)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(c.importe)}</TableCell>
                <TableCell className="text-right tabular-nums">{aCentimos(c.ajustes) ? formatoMoneda(c.ajustes) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(c.abonado)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatoMoneda(c.saldo)}</TableCell>
                <TableCell>
                  <BadgeEstadoPago estado={estadoPago(c, hoy)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function LineaTiempo({ cuotas, hoy }: { cuotas: CuotaConSaldo[]; hoy: string }) {
  return (
    <ol className="relative ml-2 border-l pl-6" aria-label="Línea de tiempo de cuotas">
      {cuotas.map((c) => {
        const estado = estadoPago(c, hoy);
        const proxima = c.vence_en >= hoy && !cuotas.some((x) => x.vence_en >= hoy && x.vence_en < c.vence_en);
        return (
          <li key={c.id} className="relative mb-5 last:mb-0">
            <span className={cn('absolute top-1 -left-[31px] size-3.5 rounded-full ring-4 ring-background', PUNTO[estado])} aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{descripcionCuota(c)}</p>
              <BadgeEstadoPago estado={estado} />
              {proxima && estado !== 'pagado' ? <Etiqueta tono="info">Próxima</Etiqueta> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Vence {formatoFecha(c.vence_en)} · {formatoMoneda(c.importe)}
              {aCentimos(c.saldo) > 0 && aCentimos(c.saldo) !== aCentimos(c.importe) ? ` · saldo ${formatoMoneda(c.saldo)}` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Estado de cuenta de los portales (alumno y padres): semáforo por cuota, línea de tiempo e historial de
 * pagos con descarga del recibo. El servidor valida el alcance (solo el propio alumno o el hijo con acceso).
 */
export function EstadoCuentaPortal(props: {
  endpoint: string;
  parametros?: Record<string, string>;
  urlRecibo: (reciboId: string) => string;
  titulo?: string;
}) {
  const [matriculaId, setMatriculaId] = useState<string | undefined>(undefined);
  const consulta = useQuery({
    queryKey: ['cobros', 'estado-cuenta', props.endpoint, props.parametros, matriculaId],
    queryFn: () => api.get<EstadoCuenta>(conConsulta(props.endpoint, { ...(props.parametros ?? {}), matriculaId })),
  });

  if (consulta.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (consulta.isError) {
    return (
      <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
        {mensajeDeError(consulta.error)}
      </div>
    );
  }
  const d = consulta.data;
  const nombre = `${d.estudiante.nombres} ${d.estudiante.apellidos}`;

  return (
    <div className="grid gap-4">
      <EncabezadoPagina
        titulo={props.titulo ?? 'Pagos'}
        descripcion={`${nombre} · código ${d.estudiante.codigo}${d.matricula ? ` · ${d.matricula.grado}${d.matricula.seccion ? ` "${d.matricula.seccion}"` : ''}` : ''}`}
        acciones={
          d.matriculas.length > 1 ? (
            <Select value={d.matricula?.id} onValueChange={setMatriculaId}>
              <SelectTrigger className="w-44" aria-label="Año escolar">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {d.matriculas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    Año {m.anio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      {!d.matricula ? (
        <EstadoVacio titulo="Sin matrícula" descripcion="No hay una matrícula registrada para mostrar el estado de cuenta." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador titulo="Total del año" valor={formatoMoneda(d.resumen.total)} icono={<Wallet className="size-4" aria-hidden />} />
            <Indicador titulo="Pagado" valor={formatoMoneda(d.resumen.abonado)} icono={<Receipt className="size-4" aria-hidden />} />
            <Indicador titulo="Saldo pendiente" valor={formatoMoneda(d.resumen.saldo)} icono={<CalendarClock className="size-4" aria-hidden />} />
            <Indicador
              titulo="Vencido"
              valor={formatoMoneda(d.resumen.vencido)}
              icono={<AlertTriangle className="size-4" aria-hidden />}
              className={aCentimos(d.resumen.vencido) > 0 ? 'border-peligro-foreground/40' : undefined}
              detalle={aCentimos(d.resumen.vencido) > 0 ? 'Regularice en caja o por los canales autorizados' : 'Al día'}
            />
          </div>

          <Tabs defaultValue="cuotas">
            <TabsList>
              <TabsTrigger value="cuotas">Cuotas</TabsTrigger>
              <TabsTrigger value="linea">Línea de tiempo</TabsTrigger>
              <TabsTrigger value="pagos">Pagos ({d.pagos.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="cuotas" className="mt-3 grid gap-3">
              <Leyenda />
              {d.cuotas.length === 0 ? <EstadoVacio titulo="Sin cuotas emitidas" descripcion="Aún no se emitieron cuotas para esta matrícula." /> : <TablaCuotas cuotas={d.cuotas} hoy={d.hoy} />}
            </TabsContent>
            <TabsContent value="linea" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle>Cronograma {d.matricula.anio}</CardTitle>
                  <CardDescription>Cada punto muestra el estado de la cuota según su saldo y vencimiento.</CardDescription>
                </CardHeader>
                <CardContent>
                  {d.cuotas.length === 0 ? <EstadoVacio titulo="Sin cuotas emitidas" /> : <LineaTiempo cuotas={d.cuotas} hoy={d.hoy} />}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="pagos" className="mt-3">
              {d.pagos.length === 0 ? (
                <EstadoVacio titulo="Sin pagos registrados" />
              ) : (
                <ul className="grid gap-2">
                  {d.pagos.map((p) => (
                    <li key={p.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium tabular-nums">
                          {formatoMoneda(p.importe)} <span className="font-normal text-muted-foreground">· {ETIQUETA_MEDIO[p.medio_ui]}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatoFechaHora(p.pagado_en)}
                          {p.recibo ? ` · Recibo ${p.recibo}` : ''}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{p.detalle}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {p.revertido ? <Etiqueta tono="peligro">Revertido</Etiqueta> : <Etiqueta tono="exito">Vigente</Etiqueta>}
                        {aCentimos(p.devuelto) > 0 ? <Etiqueta tono="info">Devuelto {formatoMoneda(p.devuelto)}</Etiqueta> : null}
                        {p.recibo_id ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={props.urlRecibo(p.recibo_id)} download aria-label={`Descargar recibo ${p.recibo ?? ''}`}>
                              <FileDown aria-hidden /> Recibo
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
