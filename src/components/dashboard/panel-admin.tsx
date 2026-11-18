'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, CalendarCheck, FileDown, GraduationCap, NotebookPen, RefreshCw, Users, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EstadoVacio, Indicador } from '@/components/datos/basicos';
import { useCatalogo, type Opcion } from '@/lib/catalogos';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoMoneda, hoyLima } from '@/lib/formato';
import type { RespuestaDashboard, ResumenAsistencia } from '@/esquemas/dashboard/dashboard';
import { GraficoAsistencia, GraficoNiveles, GraficoPlanilla, GraficoRecaudacion } from './graficos';

interface Filtros {
  anioId: string;
  desde: string;
  hasta: string;
  bimestreId: string;
}

const SIN_BIMESTRE = '__ninguno__';
const numero = new Intl.NumberFormat('es-PE');
const porcentaje = (v: number, total: number) => (total > 0 ? Math.round((1000 * v) / total) / 10 : 0);

function texto(extra: Opcion['extra'], clave: string): string {
  const v = extra?.[clave];
  return typeof v === 'string' ? v : '';
}

/** Año que contiene hoy (o el más reciente) y rango desde su inicio hasta hoy (acotado al año). */
function filtrosIniciales(anios: Opcion[]): Filtros | null {
  const hoy = hoyLima();
  const actual = anios.find((a) => texto(a.extra, 'inicio') <= hoy && hoy <= texto(a.extra, 'fin')) ?? anios[0];
  if (!actual) return null;
  return rangoDelAnio(actual, hoy);
}

function rangoDelAnio(a: Opcion, hoy = hoyLima()): Filtros {
  const inicio = texto(a.extra, 'inicio');
  const fin = texto(a.extra, 'fin');
  const hasta = hoy < inicio ? fin : hoy > fin ? fin : hoy;
  return { anioId: a.valor, desde: inicio, hasta, bimestreId: '' };
}

/** Bimestre que contiene la fecha, o el último que ya empezó. */
function bimestrePara(bimestres: Opcion[], fecha: string): string {
  const conFechas = bimestres.map((b) => ({ id: b.valor, inicio: texto(b.extra, 'inicio'), fin: texto(b.extra, 'fin') }));
  const exacto = conFechas.find((b) => b.inicio <= fecha && fecha <= b.fin);
  if (exacto) return exacto.id;
  const iniciados = conFechas.filter((b) => b.inicio <= fecha);
  return iniciados[iniciados.length - 1]?.id ?? '';
}

function Bloque(props: { titulo: string; descripcion?: ReactNode; icono: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={props.className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {props.icono}
          {props.titulo}
        </CardTitle>
        {props.descripcion ? <CardDescription>{props.descripcion}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-4">{props.children}</CardContent>
    </Card>
  );
}

function tasaAsistencia(r: ResumenAsistencia) {
  const registradas = r.esperadas - r.pendientes;
  return { pct: porcentaje(r.presentes + r.tardanzas, registradas), registradas };
}

export function PanelAdmin({ puedeExportar }: { puedeExportar: boolean }) {
  const anios = useCatalogo('anios');
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const bimestreAutomatico = useRef(true);

  useEffect(() => {
    if (!filtros && anios.data?.length) setFiltros(filtrosIniciales(anios.data));
  }, [anios.data, filtros]);

  const bimestres = useCatalogo('bimestres', { anioId: filtros?.anioId }, Boolean(filtros?.anioId));

  useEffect(() => {
    if (!filtros || !bimestres.data || !bimestreAutomatico.current) return;
    if (bimestres.data.some((b) => String(b.extra?.anioId) !== filtros.anioId)) return;
    bimestreAutomatico.current = false;
    const id = bimestrePara(bimestres.data, filtros.hasta);
    if (id) setFiltros((f) => (f ? { ...f, bimestreId: id } : f));
  }, [bimestres.data, filtros]);

  const parametros = useMemo(() => (filtros ? { ...filtros, bimestreId: filtros.bimestreId || undefined } : null), [filtros]);
  const consulta = useQuery({
    queryKey: ['dashboard-admin', parametros],
    queryFn: () => api.get<RespuestaDashboard>(conConsulta('/api/admin/dashboard', parametros ?? {})),
    enabled: Boolean(parametros?.desde && parametros?.hasta),
    placeholderData: keepPreviousData,
  });

  if (anios.isPending) return <Skeleton className="h-40 w-full" />;
  if (!anios.data?.length) {
    return <EstadoVacio titulo="Sin años académicos" descripcion="Registre el año académico para ver los indicadores institucionales." />;
  }

  const d = consulta.data;

  return (
    <div className="grid gap-4">
      <section aria-label="Filtros del panel" className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="dash-anio">Año académico</Label>
          <Select
            value={filtros?.anioId}
            onValueChange={(v) => {
              const a = anios.data?.find((x) => x.valor === v);
              if (!a) return;
              bimestreAutomatico.current = true;
              setFiltros(rangoDelAnio(a));
            }}
          >
            <SelectTrigger id="dash-anio" className="w-full">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {anios.data.map((a) => (
                <SelectItem key={a.valor} value={a.valor}>
                  {a.etiqueta} {texto(a.extra, 'estado') ? `(${texto(a.extra, 'estado')})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dash-desde">Desde</Label>
          <Input id="dash-desde" type="date" value={filtros?.desde ?? ''} onChange={(e) => setFiltros((f) => (f && e.target.value ? { ...f, desde: e.target.value } : f))} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dash-hasta">Hasta</Label>
          <Input id="dash-hasta" type="date" value={filtros?.hasta ?? ''} onChange={(e) => setFiltros((f) => (f && e.target.value ? { ...f, hasta: e.target.value } : f))} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dash-bimestre">Bimestre (notas)</Label>
          <Select
            value={filtros?.bimestreId || SIN_BIMESTRE}
            onValueChange={(v) => {
              bimestreAutomatico.current = false;
              setFiltros((f) => (f ? { ...f, bimestreId: v === SIN_BIMESTRE ? '' : v } : f));
            }}
          >
            <SelectTrigger id="dash-bimestre" className="w-full">
              <SelectValue placeholder="Opcional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_BIMESTRE}>Sin bimestre</SelectItem>
              {(bimestres.data ?? []).map((b) => (
                <SelectItem key={b.valor} value={b.valor}>
                  {b.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => void consulta.refetch()} aria-label="Actualizar indicadores" disabled={consulta.isFetching}>
            <RefreshCw className={consulta.isFetching ? 'animate-spin' : undefined} aria-hidden />
          </Button>
          {puedeExportar ? (
            <Button variant="outline" asChild>
              <Link href="/admin/reportes/documentos">
                <FileDown aria-hidden /> Exportar
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {consulta.isError ? (
        <div role="alert" className="flex items-center gap-2 rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          <AlertTriangle className="size-4" aria-hidden /> {mensajeDeError(consulta.error)}
        </div>
      ) : null}

      {!d ? (
        consulta.isError ? null : (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy={consulta.isFetching}>
          {d.matricula ? (
            <Bloque titulo="Matrícula" icono={<GraduationCap className="size-4" aria-hidden />} descripcion={`Ocupación al ${formatoFecha(filtros?.hasta)}`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Indicador titulo="Activas" valor={numero.format(d.matricula.activas)} />
                <Indicador titulo="Cupo" valor={numero.format(d.matricula.cupo)} />
                <Indicador
                  titulo="Vacantes"
                  valor={numero.format(d.matricula.vacantes_totales)}
                  detalle={`${numero.format(d.matricula.vacantes_regulares)} regulares · ${numero.format(d.matricula.vacantes_reservadas)} reservadas`}
                  className="col-span-2 sm:col-span-1"
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>Ocupación</span>
                  <span className="font-medium tabular-nums">{porcentaje(d.matricula.activas, d.matricula.cupo)} %</span>
                </div>
                <Progress value={Math.min(100, porcentaje(d.matricula.activas, d.matricula.cupo))} aria-label="Porcentaje de ocupación del cupo" />
              </div>
            </Bloque>
          ) : null}

          {d.asistencia ? (
            <Bloque titulo="Asistencia" icono={<CalendarCheck className="size-4" aria-hidden />} descripcion="Estados diarios en el rango (presentes y tardanzas sobre lo registrado)">
              <div className="grid grid-cols-2 gap-3">
                {(['alumnos', 'docentes'] as const).map((g) => {
                  const t = tasaAsistencia(d.asistencia![g]);
                  return (
                    <Indicador
                      key={g}
                      titulo={g === 'alumnos' ? 'Alumnos' : 'Docentes'}
                      valor={`${t.pct} %`}
                      detalle={`${numero.format(t.registradas)} registrados · ${numero.format(d.asistencia![g].pendientes)} sin registro`}
                      icono={g === 'alumnos' ? <GraduationCap className="size-4" aria-hidden /> : <Users className="size-4" aria-hidden />}
                    />
                  );
                })}
              </div>
              {d.asistencia.alumnos.esperadas + d.asistencia.docentes.esperadas > 0 ? (
                <GraficoAsistencia alumnos={d.asistencia.alumnos} docentes={d.asistencia.docentes} />
              ) : (
                <EstadoVacio titulo="Sin jornadas en el rango" descripcion="No hay jornadas programadas entre las fechas elegidas." />
              )}
            </Bloque>
          ) : null}

          {d.pagos ? (
            <Bloque titulo="Pagos y cobranza" icono={<Wallet className="size-4" aria-hidden />} descripcion="Cuotas del año; saldos al corte de la fecha final" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Indicador titulo="Cobrado neto" valor={formatoMoneda(d.pagos.cobrado_neto_aplicado)} detalle={`Bruto ${formatoMoneda(d.pagos.cobrado_bruto_aplicado)}`} />
                <Indicador titulo="Devuelto" valor={formatoMoneda(d.pagos.devuelto)} />
                <Indicador titulo="Revertido" valor={formatoMoneda(d.pagos.revertido)} />
                <Indicador titulo="Saldo pendiente" valor={formatoMoneda(d.pagos.saldo_pendiente)} />
                <Indicador titulo="Saldo vencido" valor={formatoMoneda(d.pagos.saldo_vencido)} />
                <Indicador titulo="Matrículas con mora" valor={numero.format(d.pagos.matriculas_con_mora)} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Recaudación por día <span className="font-normal text-muted-foreground">(importe aplicado a cuotas, antes de devoluciones y reversiones)</span>
                </h3>
                {d.pagos.recaudacion.length ? (
                  <GraficoRecaudacion datos={d.pagos.recaudacion} />
                ) : (
                  <EstadoVacio titulo="Sin cobros en el rango" descripcion="No se aplicaron pagos a cuotas del año entre las fechas elegidas." />
                )}
              </div>
            </Bloque>
          ) : null}

          {d.notas ? (
            <Bloque titulo="Notas del bimestre" icono={<NotebookPen className="size-4" aria-hidden />} descripcion="Avance de calificación y niveles de logro publicados">
              {d.notas.avance ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Indicador titulo="Esperadas" valor={numero.format(d.notas.avance.esperadas)} />
                    <Indicador titulo="Resueltas" valor={numero.format(d.notas.avance.resueltas)} />
                    <Indicador titulo="Publicadas" valor={numero.format(d.notas.avance.publicadas)} />
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span>Avance de registro</span>
                      <span className="font-medium tabular-nums">{d.notas.avance.avance_pct ?? 0} %</span>
                    </div>
                    <Progress value={Number(d.notas.avance.avance_pct ?? 0)} aria-label="Avance del registro de notas" />
                  </div>
                  {d.notas.distribucion.some((x) => x.cantidad > 0) ? (
                    <GraficoNiveles datos={d.notas.distribucion} />
                  ) : (
                    <EstadoVacio titulo="Sin notas publicadas" descripcion="La distribución AD/A/B/C aparece cuando se publiquen los cierres del bimestre." />
                  )}
                </>
              ) : (
                <EstadoVacio titulo="Elija un bimestre" descripcion="Seleccione un bimestre para ver el avance de notas y la distribución de logros." />
              )}
            </Bloque>
          ) : null}

          {d.planilla ? (
            <Bloque titulo="Planilla docente" icono={<Banknote className="size-4" aria-hidden />} descripcion="Liquidaciones de los meses del rango">
              <div className="grid grid-cols-2 gap-3">
                <Indicador
                  titulo="Liquidaciones"
                  valor={numero.format(d.planilla.liquidaciones)}
                  detalle={`${numero.format(d.planilla.aprobadas)} aprobadas · ${numero.format(d.planilla.borradores)} en borrador`}
                />
                <Indicador titulo="Neto liquidado" valor={formatoMoneda(d.planilla.neto)} />
                <Indicador titulo="Abonado" valor={formatoMoneda(d.planilla.abonado)} />
                <Indicador titulo="Saldo por pagar" valor={formatoMoneda(d.planilla.saldo)} detalle="Solo liquidaciones aprobadas" />
              </div>
              {d.planilla.porMes.length ? (
                <GraficoPlanilla datos={d.planilla.porMes} />
              ) : (
                <EstadoVacio titulo="Sin liquidaciones" descripcion="No hay liquidaciones docentes en los meses del rango." />
              )}
            </Bloque>
          ) : null}
        </div>
      )}
    </div>
  );
}
