'use client';
import { useQuery } from '@tanstack/react-query';
import { FileDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablaDatos } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio, Indicador } from '@/components/datos/basicos';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoMes, formatoMoneda, hoyLima } from '@/lib/formato';
import { NOMBRE_MODALIDAD, textoRemuneracion } from '@/esquemas/planilla/contratos';
import { OPCIONES_ESTADO_HORA, textoMinutos, type FilaHora } from '@/esquemas/planilla/horas';
import type { ResumenPlanillaDocente } from '@/esquemas/planilla/portal';

const ENDPOINT = '/api/docente/planilla';

export function ClientePlanillaDocente() {
  const consulta = useQuery({
    queryKey: ['docente', 'planilla'],
    queryFn: () => api.get<ResumenPlanillaDocente>(ENDPOINT),
  });
  const datos = consulta.data;
  const hoy = hoyLima();
  const saldoPendiente = (datos?.liquidaciones ?? []).reduce(
    (s, l) => s + Math.max(0, Number(l.saldo ?? 0)),
    0,
  );
  const ultima = datos?.liquidaciones[0];

  return (
    <>
      <EncabezadoPagina
        titulo="Mi planilla"
        descripcion="Sus contratos, horas registradas y liquidaciones aprobadas con sus pagos."
      />

      {consulta.isError ? (
        <div role="alert" className="bg-peligro text-peligro-foreground mb-4 rounded-md px-3 py-2 text-sm">
          {mensajeDeError(consulta.error)}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Indicador
          titulo="Última liquidación"
          valor={
            consulta.isPending ? <Skeleton className="h-7 w-24" /> : ultima ? formatoMoneda(ultima.neto) : '—'
          }
          detalle={ultima ? formatoMes(ultima.mes) : 'Sin liquidaciones aprobadas'}
          icono={<Wallet className="size-4" aria-hidden />}
        />
        <Indicador
          titulo="Saldo por cobrar"
          valor={consulta.isPending ? <Skeleton className="h-7 w-24" /> : formatoMoneda(saldoPendiente)}
          detalle="Liquidaciones aprobadas"
        />
        <Indicador
          titulo="Contratos vigentes"
          valor={
            consulta.isPending ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              (datos?.contratos.filter((c) => (c.inicio ?? '') <= hoy && (c.fin ?? '') >= hoy).length ?? 0)
            )
          }
          detalle={datos ? `Código docente ${datos.docente.codigo}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Liquidaciones aprobadas</CardTitle>
            <CardDescription>Descargue su boleta de pago en PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            {consulta.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : (datos?.liquidaciones.length ?? 0) === 0 ? (
              <EstadoVacio
                titulo="Sin liquidaciones"
                descripcion="Aquí aparecerán sus liquidaciones cuando sean aprobadas."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Boleta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos?.liquidaciones.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium capitalize">{formatoMes(l.mes)}</div>
                          <div className="text-muted-foreground text-xs">{l.referencia}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatoMoneda(l.neto)}</TableCell>
                        <TableCell className="text-right">
                          {Number(l.saldo ?? 0) <= 0 ? (
                            <Etiqueta tono="exito">Pagado</Etiqueta>
                          ) : (
                            <span className="tabular-nums">{formatoMoneda(l.saldo)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a
                              href={`${ENDPOINT}/liquidaciones/${l.id}/boleta`}
                              download
                              aria-label={`Descargar boleta de ${formatoMes(l.mes)}`}
                            >
                              <FileDown aria-hidden />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mis contratos</CardTitle>
          </CardHeader>
          <CardContent>
            {consulta.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : (datos?.contratos.length ?? 0) === 0 ? (
              <EstadoVacio titulo="Sin contratos" />
            ) : (
              <ul className="grid gap-2">
                {datos?.contratos.map((c) => {
                  const estado =
                    (c.inicio ?? '') > hoy ? 'programada' : (c.fin ?? '') < hoy ? 'cerrado' : 'activo';
                  return (
                    <li key={c.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{c.referencia}</span>
                        <BadgeEstado estado={estado} />
                      </div>
                      <span className="text-muted-foreground">
                        {NOMBRE_MODALIDAD[c.modalidad]} · {textoRemuneracion(c)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatoFecha(c.inicio)} – {formatoFecha(c.fin)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="titulo-horas" className="mt-6 grid gap-3">
        <h3 id="titulo-horas" className="text-lg font-semibold">
          Horas registradas
        </h3>
        <TablaDatos<FilaHora>
          endpoint={`${ENDPOINT}/horas`}
          claveFila={(f) => f.id}
          placeholderBusqueda="Buscar por motivo o contrato…"
          filtros={[
            { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO_HORA },
            { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
            { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
          ]}
          vacio={
            <EstadoVacio titulo="Sin horas registradas" descripcion="Solo aplica a contratos por horas." />
          }
          columnas={[
            {
              clave: 'fecha',
              titulo: 'Fecha',
              celda: (f) => (
                <div className="tabular-nums">
                  <div className="font-medium">{formatoFecha(f.fecha)}</div>
                  <div className="text-muted-foreground text-xs">
                    {f.hora_inicio}–{f.hora_fin}
                  </div>
                </div>
              ),
            },
            { clave: 'minutos', titulo: 'Tiempo', celda: (f) => textoMinutos(f.minutos) },
            {
              clave: 'motivo',
              titulo: 'Motivo',
              ocultarEnMovil: true,
              celda: (f) => <span className="line-clamp-2 max-w-72">{f.motivo}</span>,
            },
            {
              clave: 'estado',
              titulo: 'Estado',
              celda: (f) => (
                <div className="grid gap-1">
                  <BadgeEstado estado={f.estado} />
                  {f.decision ? (
                    <span className="text-muted-foreground max-w-48 text-xs">{f.decision}</span>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
