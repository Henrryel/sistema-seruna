'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileDown, HandCoins, ListOrdered, Plus, UserRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeEstadoPago, Etiqueta, estadoPago } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { claveListado } from '@/components/datos/tabla-datos';
import { Confirmar } from '@/components/formularios/confirmar';
import { BuscadorAlumno } from '@/components/cobros/buscador-alumno';
import { ApiError, api, mensajeDeError } from '@/lib/api';
import { useCatalogo, type Opcion } from '@/lib/catalogos';
import { formatoFecha, formatoMoneda } from '@/lib/formato';
import {
  ETIQUETA_MEDIO,
  MEDIOS_PAGO,
  TIPOS_DOCUMENTO_PAGANTE,
  distribuirPorRegla,
  esquemaPago,
  nuevaClaveIdempotencia,
  type AlumnoBusqueda,
  type CuentaCobro,
  type MedioPago,
  type ResultadoPago,
} from '@/esquemas/cobros/pagos';
import type { SesionActual } from '@/esquemas/cobros/caja';
import { descripcionCuota } from '@/esquemas/cobros/cuotas';
import { aCentimos, deCentimos } from '@/esquemas/cobros/dinero';
import { cn } from '@/lib/utils';

const API = '/api/admin/cobros';

export function ClienteCobrar() {
  const [alumno, setAlumno] = useState<AlumnoBusqueda | null>(null);
  const [matriculaId, setMatriculaId] = useState<string | undefined>(undefined);
  const [resultado, setResultado] = useState<ResultadoPago | null>(null);
  // Tras cada cobro el formulario se reinicia (evita repetir por accidente el mismo importe con otra clave).
  const [cobros, setCobros] = useState(0);
  const cuenta = useQuery({
    queryKey: ['cobros', 'cuenta', alumno?.estudiante_id, matriculaId],
    queryFn: () => api.get<CuentaCobro>(`${API}/alumnos/${alumno?.estudiante_id}/cuenta${matriculaId ? `?matriculaId=${matriculaId}` : ''}`),
    enabled: Boolean(alumno),
  });
  const sesion = useQuery({ queryKey: ['cobros', 'sesion-actual'], queryFn: () => api.get<SesionActual>(`${API}/sesiones/actual`) });
  const series = useCatalogo('series');

  return (
    <>
      <EncabezadoPagina
        titulo="Cobrar"
        descripcion="Busque al alumno, elija las cuotas y registre el pago. El pago, su imputación y el recibo se guardan en una sola operación."
        acciones={
          sesion.data?.sesion ? (
            <Etiqueta tono="info">
              <Wallet className="mr-1 size-3" aria-hidden /> {sesion.data.sesion.caja} abierta
            </Etiqueta>
          ) : sesion.isSuccess ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/cobros/caja">
                <Wallet aria-hidden /> Abrir caja
              </Link>
            </Button>
          ) : null
        }
      />

      {resultado ? (
        <Card className="mb-4 border-exito-foreground/40" role="status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-exito-foreground" aria-hidden /> Pago registrado · Recibo {resultado.recibo}
            </CardTitle>
            <CardDescription>{resultado.repetido ? 'Este pago ya estaba registrado con la misma clave: se muestra el mismo recibo.' : 'El saldo de las cuotas se actualizó.'}</CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={`${API}/pagos/${resultado.pagoId}/recibo`} download>
                <FileDown aria-hidden /> Descargar recibo PDF
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResultado(null);
                setAlumno(null);
                setMatriculaId(undefined);
              }}
            >
              <Plus aria-hidden /> Nuevo cobro
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4" aria-hidden /> Alumno
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <BuscadorAlumno
              autoFocus
              seleccionado={alumno?.estudiante_id}
              alSeleccionar={(a) => {
                setAlumno(a);
                setMatriculaId(undefined);
                setResultado(null);
              }}
            />
            {cuenta.data ? (
              <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">
                  {cuenta.data.alumno.apellidos}, {cuenta.data.alumno.nombres}
                </p>
                <p className="text-muted-foreground">Código {cuenta.data.alumno.codigo}</p>
                {cuenta.data.matriculas.length > 0 ? (
                  <div className="grid gap-1">
                    <Label htmlFor="cobro-matricula">Matrícula</Label>
                    <Select value={cuenta.data.matricula?.id} onValueChange={setMatriculaId}>
                      <SelectTrigger id="cobro-matricula" className="w-full bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cuenta.data.matriculas.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.anio} · {m.grado}
                            {m.seccion ? ` "${m.seccion}"` : ''} ({m.estado})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Sin matrículas registradas.</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {!alumno ? (
          <EstadoVacio icono={<HandCoins className="size-8" aria-hidden />} titulo="Seleccione un alumno" descripcion="Busque por apellidos, nombres, código o DNI para ver sus cuotas con saldo." />
        ) : cuenta.isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : cuenta.isError ? (
          <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
            {mensajeDeError(cuenta.error)}
          </div>
        ) : !cuenta.data.matricula ? (
          <EstadoVacio titulo="Sin matrícula" descripcion="El alumno no tiene matrícula con cuotas para cobrar." />
        ) : (
          <FormularioCobro
            key={`${cuenta.data.matricula.id}-${cobros}`}
            cuenta={cuenta.data}
            sesion={sesion.data}
            series={series.data ?? []}
            alRegistrar={(r) => {
              setResultado(r);
              setCobros((n) => n + 1);
            }}
          />
        )}
      </div>
    </>
  );
}

type Modo = 'regla' | 'eleccion_pagante';

function FormularioCobro(props: { cuenta: CuentaCobro; sesion: SesionActual | undefined; series: Opcion[]; alRegistrar: (r: ResultadoPago) => void }) {
  const qc = useQueryClient();
  const { cuenta } = props;
  const hoy = cuenta.hoy;
  const cuotas = cuenta.cuotas;
  const exigibles = cuotas.filter((c) => c.exigible_desde <= hoy);
  const deudaExigible = exigibles.reduce((t, c) => t + aCentimos(c.saldo), 0);
  const haySesion = Boolean(props.sesion?.sesion);

  const [modo, setModo] = useState<Modo>('regla');
  const [importe, setImporte] = useState('');
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [medio, setMedio] = useState<MedioPago>(props.sesion && !props.sesion.sesion ? 'transferencia' : 'efectivo');
  const [referencia, setReferencia] = useState('');
  const [serieId, setSerieId] = useState<string>(props.series[0]?.valor ?? '');
  const [recibido, setRecibido] = useState('');
  const primerApoderado = cuenta.apoderados[0];
  const [paganteSel, setPaganteSel] = useState<string>(primerApoderado?.persona_id ?? 'otro');
  const [pagante, setPagante] = useState({
    nombre: primerApoderado?.nombre ?? '',
    tipoDocumento: primerApoderado?.tipo_documento ?? 'DNI',
    numeroDocumento: primerApoderado?.numero_documento ?? '',
    direccion: primerApoderado?.direccion ?? '',
  });
  const clave = useRef(nuevaClaveIdempotencia());
  const serieActual = serieId || props.series[0]?.valor || '';

  const vista = useMemo(() => {
    if (modo === 'regla') {
      const candidatas = seleccion.length ? cuotas.filter((c) => seleccion.includes(c.id)) : cuotas;
      const d = distribuirPorRegla(importe || '0', candidatas, hoy);
      return { total: aCentimos(importe || '0'), porCuota: new Map(d.aplicaciones.map((a) => [a.cuotaId, a.centimos])), excedente: d.excedente };
    }
    const porCuota = new Map(Object.entries(montos).filter(([, v]) => aCentimos(v) > 0).map(([k, v]) => [k, aCentimos(v)]));
    return { total: [...porCuota.values()].reduce((t, v) => t + v, 0), porCuota, excedente: 0 };
  }, [modo, seleccion, cuotas, importe, hoy, montos]);

  const total = Number.isNaN(vista.total) ? 0 : vista.total;
  const vuelto = medio === 'efectivo' && recibido ? aCentimos(recibido) - total : null;

  const elegirPagante = (v: string) => {
    setPaganteSel(v);
    const a = cuenta.apoderados.find((x) => x.persona_id === v);
    setPagante(
      a
        ? { nombre: a.nombre, tipoDocumento: a.tipo_documento ?? 'DNI', numeroDocumento: a.numero_documento ?? '', direccion: a.direccion ?? '' }
        : { nombre: '', tipoDocumento: 'DNI', numeroDocumento: '', direccion: '' },
    );
  };

  const construir = () =>
    esquemaPago.safeParse({
      claveIdempotencia: clave.current,
      matriculaId: cuenta.matricula?.id,
      serieId: serieActual,
      medio,
      referencia: referencia || null,
      importe: deCentimos(total),
      imputacion: modo,
      aplicaciones: modo === 'eleccion_pagante' ? [...vista.porCuota.entries()].map(([cuotaId, c]) => ({ cuotaId, importe: deCentimos(c) })) : [],
      cuotas: modo === 'regla' ? seleccion : [],
      pagante: {
        personaId: paganteSel !== 'otro' ? paganteSel : undefined,
        tipoDocumento: pagante.tipoDocumento || null,
        numeroDocumento: pagante.numeroDocumento || null,
        nombre: pagante.nombre,
        direccion: pagante.direccion || null,
      },
    });

  const validacion = construir();
  const problemas: string[] = [];
  if (total <= 0) problemas.push('Indique el importe a cobrar');
  if (!serieActual) problemas.push('No hay series de recibos activas');
  if (medio === 'efectivo' && !haySesion) problemas.push('Abra su sesión de caja para cobrar en efectivo');
  if (!validacion.success && problemas.length === 0) problemas.push(validacion.error.issues[0]?.message ?? 'Revise los datos');

  const registrar = async () => {
    const r = construir();
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? 'Revise los datos');
    try {
      const res = await api.post<ResultadoPago>(`${API}/pagos`, r.data);
      clave.current = nuevaClaveIdempotencia();
      props.alRegistrar(res);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cobros', 'cuenta'] }),
        qc.invalidateQueries({ queryKey: ['cobros', 'sesion-actual'] }),
        qc.invalidateQueries({ queryKey: claveListado(`${API}/pagos`) }),
      ]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      // 4xx: el servidor rechazó y nada se guardó → nueva clave. Red/5xx: se conserva para reintentar sin duplicar.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) clave.current = nuevaClaveIdempotencia();
      else if (!(e instanceof ApiError) || e.status >= 500) {
        throw new Error(`${mensajeDeError(e)}. Puede reintentar: se usará la misma clave y no se duplicará el cobro.`);
      }
      throw e;
    }
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="size-4" aria-hidden /> Cuotas con saldo
          </CardTitle>
          <CardDescription>
            Deuda exigible: <span className="font-semibold text-foreground">{formatoMoneda(deCentimos(deudaExigible))}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="grid gap-2 sm:grid-cols-2" aria-label="Forma de imputar el pago">
            <Label htmlFor="modo-regla" className="flex cursor-pointer items-start gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary">
              <RadioGroupItem id="modo-regla" value="regla" className="mt-0.5" />
              <span>
                <span className="block font-medium">Más antigua primero</span>
                <span className="block text-xs font-normal text-muted-foreground">Ingrese un importe; se imputa por vencimiento.</span>
              </span>
            </Label>
            <Label htmlFor="modo-eleccion" className="flex cursor-pointer items-start gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary">
              <RadioGroupItem id="modo-eleccion" value="eleccion_pagante" className="mt-0.5" />
              <span>
                <span className="block font-medium">Elección del pagante</span>
                <span className="block text-xs font-normal text-muted-foreground">Indique cuánto abona a cada cuota.</span>
              </span>
            </Label>
          </RadioGroup>

          {modo === 'regla' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="cobro-importe">Importe a cobrar (S/)</Label>
                <Input id="cobro-importe" type="number" min="0" step="0.01" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} />
              </div>
              <Button type="button" variant="outline" onClick={() => setImporte(deCentimos(deudaExigible))} disabled={deudaExigible <= 0}>
                Toda la deuda exigible
              </Button>
            </div>
          ) : null}

          {cuotas.length === 0 ? (
            <EstadoVacio titulo="Sin cuotas pendientes" descripcion="La matrícula no tiene cuotas con saldo." />
          ) : (
            <ul className="grid gap-2" aria-label="Cuotas con saldo">
              {cuotas.map((c) => {
                const exigible = c.exigible_desde <= hoy;
                const aplicado = vista.porCuota.get(c.id) ?? 0;
                const marcada = modo === 'regla' ? seleccion.includes(c.id) : aCentimos(montos[c.id]) > 0;
                return (
                  <li key={c.id} className={cn('rounded-lg border p-3', !exigible && 'opacity-60', aplicado > 0 && 'border-primary/50 bg-primary/5')}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`cuota-${c.id}`}
                        className="mt-1"
                        disabled={!exigible}
                        checked={marcada}
                        aria-label={`Incluir ${descripcionCuota(c)}`}
                        onCheckedChange={(v) => {
                          if (modo === 'regla') setSeleccion((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)));
                          else setMontos((m) => ({ ...m, [c.id]: v ? c.saldo : '' }));
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor={`cuota-${c.id}`} className="font-medium">
                            {descripcionCuota(c)}
                          </label>
                          <BadgeEstadoPago estado={estadoPago(c, hoy)} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Vence {formatoFecha(c.vence_en)} · importe {formatoMoneda(c.importe)}
                          {aCentimos(c.ajustes) ? ` · ajustes ${formatoMoneda(c.ajustes)}` : ''}
                          {!exigible ? ` · exigible desde ${formatoFecha(c.exigible_desde)}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="font-semibold tabular-nums">{formatoMoneda(c.saldo)}</p>
                      </div>
                    </div>
                    {modo === 'eleccion_pagante' && exigible ? (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Label htmlFor={`monto-${c.id}`} className="text-xs">
                          Abonar S/
                        </Label>
                        <Input
                          id={`monto-${c.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="h-8 w-32 text-right"
                          value={montos[c.id] ?? ''}
                          onChange={(e) => setMontos((m) => ({ ...m, [c.id]: e.target.value }))}
                        />
                      </div>
                    ) : null}
                    {modo === 'regla' && aplicado > 0 ? (
                      <p className="mt-1 text-right text-xs text-primary">Se aplicará {formatoMoneda(deCentimos(aplicado))}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {modo === 'regla' && seleccion.length ? (
            <p className="text-xs text-muted-foreground">El importe se imputará solo a las {seleccion.length} cuota(s) marcadas, de la más antigua a la más reciente.</p>
          ) : null}
          {vista.excedente > 0 ? (
            <p role="alert" className="flex items-center gap-2 rounded-md bg-alerta px-3 py-2 text-sm text-alerta-foreground">
              <AlertTriangle className="size-4" aria-hidden /> El importe excede el saldo exigible en {formatoMoneda(deCentimos(vista.excedente))}: la base rechazará el abono.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="h-fit 2xl:sticky 2xl:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HandCoins className="size-4" aria-hidden /> Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cobro-medio">Medio de pago</Label>
            <Select value={medio} onValueChange={(v) => setMedio(v as MedioPago)}>
              <SelectTrigger id="cobro-medio" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIOS_PAGO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ETIQUETA_MEDIO[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {medio === 'efectivo' && !haySesion ? (
              <p className="text-xs text-peligro-foreground">
                No tiene sesión de caja abierta.{' '}
                <Link href="/admin/cobros/caja" className="underline">
                  Abrir caja
                </Link>
              </p>
            ) : null}
            {medio === 'yape' || medio === 'plin' ? (
              <p className="text-xs text-muted-foreground">Se registra como transferencia con la referencia «{ETIQUETA_MEDIO[medio]}: n.º de operación».</p>
            ) : null}
          </div>
          {medio !== 'efectivo' ? (
            <div className="grid gap-2">
              <Label htmlFor="cobro-referencia">{medio === 'tarjeta' ? 'Voucher / lote' : medio === 'otro' ? 'Referencia' : 'N.º de operación'}</Label>
              <Input id="cobro-referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={120} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="cobro-recibido">Recibido (S/)</Label>
                <Input id="cobro-recibido" type="number" min="0" step="0.01" inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium">Vuelto</span>
                <p className={cn('flex h-9 items-center font-semibold tabular-nums', vuelto !== null && vuelto < 0 && 'text-peligro-foreground')} aria-live="polite">
                  {vuelto === null || Number.isNaN(vuelto) ? '—' : formatoMoneda(deCentimos(vuelto))}
                </p>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="cobro-serie">Serie del recibo</Label>
            <Select value={serieActual} onValueChange={setSerieId}>
              <SelectTrigger id="cobro-serie" className="w-full">
                <SelectValue placeholder="Sin series activas" />
              </SelectTrigger>
              <SelectContent>
                {props.series.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="grid gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Pagante</legend>
            <Select value={paganteSel} onValueChange={elegirPagante}>
              <SelectTrigger className="w-full" aria-label="Pagante">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cuenta.apoderados.map((a) => (
                  <SelectItem key={a.persona_id} value={a.persona_id}>
                    {a.nombre} ({a.parentesco})
                  </SelectItem>
                ))}
                <SelectItem value="otro">Otra persona</SelectItem>
              </SelectContent>
            </Select>
            <Label htmlFor="pagante-nombre" className="text-xs">
              Nombre
            </Label>
            <Input id="pagante-nombre" value={pagante.nombre} onChange={(e) => setPagante((p) => ({ ...p, nombre: e.target.value }))} maxLength={200} />
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <div className="grid gap-1">
                <Label htmlFor="pagante-tipo" className="text-xs">
                  Documento
                </Label>
                <Select value={pagante.tipoDocumento} onValueChange={(v) => setPagante((p) => ({ ...p, tipoDocumento: v }))}>
                  <SelectTrigger id="pagante-tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO_PAGANTE.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="pagante-numero" className="text-xs">
                  Número
                </Label>
                <Input id="pagante-numero" value={pagante.numeroDocumento} onChange={(e) => setPagante((p) => ({ ...p, numeroDocumento: e.target.value }))} maxLength={20} />
              </div>
            </div>
            <Label htmlFor="pagante-direccion" className="text-xs">
              Dirección (opcional)
            </Label>
            <Input id="pagante-direccion" value={pagante.direccion} onChange={(e) => setPagante((p) => ({ ...p, direccion: e.target.value }))} maxLength={300} />
          </fieldset>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Total a cobrar</span>
            <span className="text-2xl font-semibold tabular-nums">{formatoMoneda(deCentimos(total))}</span>
          </div>
          {problemas.length ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {problemas[0]}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Confirmar
            titulo={`¿Registrar el cobro de ${formatoMoneda(deCentimos(total))}?`}
            descripcion={`${cuenta.alumno.apellidos}, ${cuenta.alumno.nombres} · ${ETIQUETA_MEDIO[medio]}${referencia && medio !== 'efectivo' ? ` (${referencia})` : ''} · pagante ${pagante.nombre || '—'}. Se emitirá el recibo con la serie ${props.series.find((s) => s.valor === serieActual)?.etiqueta ?? ''}.`}
            textoConfirmar="Cobrar"
            mensajeExito="Pago registrado"
            alConfirmar={registrar}
            disparador={
              <Button className="w-full" size="lg" disabled={problemas.length > 0}>
                <HandCoins aria-hidden /> Cobrar {formatoMoneda(deCentimos(total))}
              </Button>
            }
          />
        </CardFooter>
      </Card>
    </div>
  );
}
