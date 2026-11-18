'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  FileDown,
  HandCoins,
  ListPlus,
  Loader2,
  Paperclip,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { CampoArchivo, cuerpoConArchivo, urlArchivo } from './campo-archivo';
import { TotalesLiquidacion } from './totales';
import { uuidV4 } from './uuid';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora, formatoHora, formatoMes, formatoMoneda } from '@/lib/formato';
import { NOMBRE_MODALIDAD, textoRemuneracion } from '@/esquemas/planilla/contratos';
import { textoMinutos } from '@/esquemas/planilla/horas';
import {
  esquemaLinea,
  esquemaPago,
  esquemaReversion,
  OPCIONES_MEDIO_PAGO,
  type DetalleLiquidacion,
  type PagoLiquidacion,
  type VistaPreviaTardanzas,
} from '@/esquemas/planilla/liquidaciones';

const EP = '/api/admin/planilla/liquidaciones';
const NOMBRE_MEDIO: Record<string, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  otro: 'Otro',
};

export const claveLiquidacion = (id: string) => ['planilla', 'liquidacion', id] as const;

/** Detalle completo de una liquidación con sus acciones según estado y permisos. */
export function PanelLiquidacion(props: {
  id: string;
  puedeLiquidar: boolean;
  puedePagar: boolean;
  puedeRevertir: boolean;
  alCambiar: () => Promise<unknown>;
  alEliminar: () => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: claveLiquidacion(props.id),
    queryFn: () => api.get<DetalleLiquidacion>(`${EP}/${props.id}`),
  });
  const [dialogo, setDialogo] = useState<null | 'linea' | 'tardanzas' | 'pago'>(null);
  const [revirtiendo, setRevirtiendo] = useState<PagoLiquidacion | null>(null);
  const [incluyendo, setIncluyendo] = useState(false);

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: claveLiquidacion(props.id) });
    await props.alCambiar();
  };

  if (consulta.isPending) {
    return (
      <div className="grid gap-3 p-4" aria-busy="true">
        <SheetTitle className="sr-only">Cargando liquidación</SheetTitle>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (consulta.isError) {
    return (
      <div className="p-4">
        <SheetTitle className="sr-only">Liquidación</SheetTitle>
        <p role="alert" className="text-destructive text-sm">
          {mensajeDeError(consulta.error)}
        </p>
      </div>
    );
  }

  const d = consulta.data;
  const borrador = d.estado === 'borrador';
  const porHoras = d.modalidad === 'por_horas';
  const saldo = Number(d.totales.saldo ?? 0);
  const editable = borrador && props.puedeLiquidar;

  return (
    <div className="grid gap-4 pb-6">
      <SheetHeader className="pb-0">
        <SheetTitle className="pr-6">{d.docente}</SheetTitle>
        <SheetDescription>
          {formatoMes(d.mes)} · {d.referencia} · Liquidación N.º {d.id}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeEstado estado={d.estado} />
          <Etiqueta tono="neutro">{NOMBRE_MODALIDAD[d.modalidad]}</Etiqueta>
          {d.estado === 'aprobada' && saldo <= 0 ? <Etiqueta tono="exito">Pagada</Etiqueta> : null}
        </div>
      </SheetHeader>

      <div className="grid gap-4 px-4">
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Condiciones congeladas</dt>
            <dd>{textoRemuneracion(d)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Días liquidados</dt>
            <dd className="tabular-nums">
              {formatoFecha(d.vigencia_inicio)} – {formatoFecha(d.vigencia_fin)}
            </dd>
          </div>
          {d.motivo_prorrateo ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Prorrateo autorizado</dt>
              <dd>
                {formatoMoneda(d.importe_fijo)} · {d.motivo_prorrateo}
              </dd>
            </div>
          ) : null}
          {d.aprobado_en ? (
            <div>
              <dt className="text-muted-foreground">Aprobada</dt>
              <dd>{formatoFechaHora(d.aprobado_en)}</dd>
            </div>
          ) : null}
        </dl>

        <TotalesLiquidacion totales={d.totales} porHoras={porHoras} />

        {borrador && porHoras && (d.horas_pendientes > 0 || d.horas_por_incluir > 0) ? (
          <div
            role="status"
            className="bg-alerta text-alerta-foreground grid gap-2 rounded-md px-3 py-2 text-sm"
          >
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {d.horas_pendientes > 0
                  ? `${d.horas_pendientes} registro(s) de horas del mes siguen pendientes. `
                  : ''}
                {d.horas_por_incluir > 0
                  ? `${d.horas_por_incluir} registro(s) aprobados aún no están incluidos. `
                  : ''}
                La base no permitirá aprobar hasta resolverlos e incluirlos.
              </span>
            </p>
            {d.horas_por_incluir > 0 && props.puedeLiquidar ? (
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={incluyendo}
                onClick={async () => {
                  setIncluyendo(true);
                  try {
                    const r = await api.post<{ horasIncluidas: number }>(`${EP}/${d.id}/horas`);
                    toast.success(`${r.horasIncluidas} registro(s) de horas incluidos`);
                    await refrescar();
                  } catch (e) {
                    toast.error(mensajeDeError(e));
                  } finally {
                    setIncluyendo(false);
                  }
                }}
              >
                {incluyendo ? <Loader2 className="animate-spin" aria-hidden /> : <Clock aria-hidden />}{' '}
                Incluir horas aprobadas
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {editable ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialogo('linea')}>
                <ListPlus aria-hidden /> Adicional o descuento
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialogo('tardanzas')}>
                <Clock aria-hidden /> Descuento por tardanzas
              </Button>
              <Confirmar
                titulo="¿Aprobar la liquidación?"
                descripcion="Aprobada, la liquidación queda inmutable y se habilitan los pagos. La base verifica que el neto no sea negativo y que estén incluidas todas las horas aprobadas del mes."
                textoConfirmar="Aprobar"
                mensajeExito="Liquidación aprobada"
                alConfirmar={async () => {
                  await api.post(`${EP}/${d.id}/aprobar`);
                  await refrescar();
                }}
                disparador={
                  <Button size="sm">
                    <BadgeCheck aria-hidden /> Aprobar
                  </Button>
                }
              />
            </>
          ) : null}
          {d.estado === 'aprobada' && props.puedePagar && saldo > 0 ? (
            <Button size="sm" onClick={() => setDialogo('pago')}>
              <HandCoins aria-hidden /> Registrar pago
            </Button>
          ) : null}
          <Button size="sm" variant="outline" asChild>
            <a href={`${EP}/${d.id}/boleta`} download>
              <FileDown aria-hidden /> {borrador ? 'Boleta (borrador)' : 'Boleta PDF'}
            </a>
          </Button>
          {editable ? (
            <Confirmar
              titulo="¿Eliminar este borrador?"
              descripcion="Se quitan sus líneas y la liquidación. Úselo para rehacerla (p. ej. con otro importe prorrateado). Las aprobadas no se pueden eliminar."
              destructivo
              textoConfirmar="Eliminar"
              mensajeExito="Borrador eliminado"
              alConfirmar={async () => {
                await api.delete(`${EP}/${d.id}`);
                await props.alEliminar();
              }}
              disparador={
                <Button size="sm" variant="ghost" className="text-destructive">
                  <Trash2 aria-hidden /> Eliminar borrador
                </Button>
              }
            />
          ) : null}
        </div>

        <Separator />

        <section aria-labelledby="titulo-detalle" className="grid gap-2">
          <h3 id="titulo-detalle" className="font-medium">
            Detalle
          </h3>
          {d.lineas.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {porHoras
                ? 'Sin horas aprobadas incluidas.'
                : 'Sin adicionales ni descuentos: se paga la remuneración base.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    {editable ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.lineas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-wrap items-center gap-2">
                          <Etiqueta
                            tono={
                              l.tipo === 'descuento' ? 'peligro' : l.tipo === 'adicional' ? 'exito' : 'info'
                            }
                          >
                            {l.tipo === 'horas'
                              ? 'Horas'
                              : l.tipo === 'adicional'
                                ? 'Adicional'
                                : 'Descuento'}
                          </Etiqueta>
                          <span>{l.concepto}</span>
                        </div>
                        {l.tipo === 'horas' ? (
                          <span className="text-muted-foreground text-xs">{textoMinutos(l.minutos)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.importe === null
                          ? '—'
                          : `${l.tipo === 'descuento' ? '− ' : ''}${formatoMoneda(l.importe)}`}
                      </TableCell>
                      {editable ? (
                        <TableCell>
                          {l.tipo !== 'horas' ? (
                            <Confirmar
                              titulo="¿Quitar esta línea?"
                              descripcion={l.concepto}
                              destructivo
                              textoConfirmar="Quitar"
                              mensajeExito="Línea quitada"
                              alConfirmar={async () => {
                                await api.delete(`${EP}/${d.id}/detalle/${l.id}`);
                                await refrescar();
                              }}
                              disparador={
                                <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${l.concepto}`}>
                                  <Trash2 aria-hidden />
                                </Button>
                              }
                            />
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {d.estado === 'aprobada' ? (
          <section aria-labelledby="titulo-pagos" className="grid gap-2">
            <h3 id="titulo-pagos" className="font-medium">
              Pagos
            </h3>
            {d.pagos.length === 0 ? (
              <EstadoVacio
                titulo="Sin pagos"
                descripcion={`Saldo por pagar: ${formatoMoneda(d.totales.saldo)}`}
              />
            ) : (
              <ul className="grid gap-2">
                {d.pagos.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="grid gap-0.5">
                      <span className={p.reversion_id ? 'font-medium line-through' : 'font-medium'}>
                        {formatoMoneda(p.importe)} · {NOMBRE_MEDIO[p.medio] ?? p.medio}
                      </span>
                      <span className="text-muted-foreground">
                        {formatoFechaHora(p.pagado_en)}
                        {p.referencia ? ` · Ref. ${p.referencia}` : ''}
                      </span>
                      {p.reversion_id ? (
                        <span className="text-destructive">
                          Revertido el {formatoFechaHora(p.revertido_en)}: {p.motivo_reversion}
                        </span>
                      ) : null}
                      <span className="flex gap-3">
                        {p.evidencia_id ? (
                          <a
                            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                            href={urlArchivo(p.evidencia_id)}
                          >
                            <Paperclip className="size-3" aria-hidden /> Evidencia del pago
                          </a>
                        ) : null}
                        {p.evidencia_reversion_id ? (
                          <a
                            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                            href={urlArchivo(p.evidencia_reversion_id)}
                          >
                            <Paperclip className="size-3" aria-hidden /> Evidencia de la reversión
                          </a>
                        ) : null}
                      </span>
                    </div>
                    {!p.reversion_id && props.puedeRevertir ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRevirtiendo(p)}
                        aria-label={`Revertir pago de ${formatoMoneda(p.importe)}`}
                      >
                        <Undo2 aria-hidden /> Revertir
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <DialogoFormulario
        titulo="Agregar adicional o descuento"
        descripcion="Solo mientras la liquidación esté en borrador."
        esquema={esquemaLinea}
        valores={{ tipo: 'adicional', concepto: '', importe: '' }}
        abierto={dialogo === 'linea'}
        alCambiarAbierto={(v) => setDialogo(v ? 'linea' : null)}
        alEnviar={async (datos) => {
          await api.post(`${EP}/${d.id}/detalle`, datos);
          await refrescar();
        }}
        mensajeExito="Línea agregada"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect
            nombre="tipo"
            etiqueta="Tipo"
            opciones={[
              { valor: 'adicional', etiqueta: 'Adicional (+)' },
              { valor: 'descuento', etiqueta: 'Descuento (−)' },
            ]}
          />
          <CampoTexto nombre="importe" etiqueta="Importe (S/)" tipo="number" paso="0.01" />
          <CampoTexto
            nombre="concepto"
            etiqueta="Concepto"
            className="sm:col-span-2"
            placeholder="Bono por tutoría, adelanto…"
          />
        </div>
      </DialogoFormulario>

      {dialogo === 'tardanzas' ? (
        <DialogoTardanzas
          id={d.id}
          porHoras={porHoras}
          alCerrar={() => setDialogo(null)}
          alRegistrar={refrescar}
        />
      ) : null}

      {dialogo === 'pago' ? (
        <DialogoPago detalle={d} alCerrar={() => setDialogo(null)} alPagar={refrescar} />
      ) : null}

      {revirtiendo ? (
        <DialogoReversion pago={revirtiendo} alCerrar={() => setRevirtiendo(null)} alRevertir={refrescar} />
      ) : null}
    </div>
  );
}

function DialogoTardanzas(props: {
  id: string;
  porHoras: boolean;
  alCerrar: () => void;
  alRegistrar: () => Promise<unknown>;
}) {
  const consulta = useQuery({
    queryKey: ['planilla', 'tardanzas', props.id],
    queryFn: () => api.get<VistaPreviaTardanzas>(`${EP}/${props.id}/tardanzas`),
    staleTime: 0,
  });
  const [enviando, setEnviando] = useState(false);
  const v = consulta.data;
  const sinMarcacion = v?.dias.filter((x) => x.minutos === null).length ?? 0;
  const puedeRegistrar = Boolean(v && !v.ya_registrado && Number(v.importe) > 0 && v.valor_minuto !== null);
  return (
    <Dialog open onOpenChange={(o) => !o && props.alCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Descuento por tardanzas</DialogTitle>
          <DialogDescription>
            Minutos = entrada − (inicio de la jornada + tolerancia de la política), solo días en estado
            «tarde» (no se descuentan los justificados). Valor por minuto ={' '}
            {props.porHoras
              ? 'tarifa por hora ÷ minutos de la hora pedagógica'
              : 'sueldo mensual ÷ minutos programados de las jornadas del mes'}
            .
          </DialogDescription>
        </DialogHeader>
        {consulta.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : consulta.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {mensajeDeError(consulta.error)}
          </p>
        ) : v ? (
          <div className="grid gap-3">
            {v.dias.length === 0 ? (
              <EstadoVacio
                titulo="Sin tardanzas"
                descripcion="No hay días en estado «tarde» en el período de la liquidación."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Jornada + tolerancia</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead className="text-right">Minutos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {v.dias.map((x) => (
                      <TableRow key={x.fecha}>
                        <TableCell className="tabular-nums">{formatoFecha(x.fecha)}</TableCell>
                        <TableCell className="tabular-nums">
                          {x.inicio_jornada} + {x.tolerancia_minutos} min
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {x.entrada ? formatoHora(x.entrada) : 'Sin marcación'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{x.minutos ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {sinMarcacion > 0 ? (
              <p className="text-muted-foreground text-sm">
                {sinMarcacion} tardanza(s) sin marcación de entrada no se pueden medir y no se descuentan.
              </p>
            ) : null}
            <dl className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Minutos</dt>
                <dd className="font-medium tabular-nums">{v.minutos}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {props.porHoras ? 'Minutos por hora' : 'Minutos programados'}
                </dt>
                <dd className="font-medium tabular-nums">{v.minutos_base}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valor por minuto</dt>
                <dd className="font-medium tabular-nums">
                  {v.valor_minuto === null
                    ? '—'
                    : `S/ ${Number(v.valor_minuto).toLocaleString('es-PE', { maximumFractionDigits: 6 })}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Descuento</dt>
                <dd className="font-semibold tabular-nums">{formatoMoneda(v.importe)}</dd>
              </div>
            </dl>
            {v.valor_minuto === null ? (
              <p className="text-destructive text-sm">
                El docente no tiene jornadas programadas en el mes: no se puede calcular el valor por minuto.
              </p>
            ) : null}
            {v.ya_registrado ? (
              <p className="text-muted-foreground text-sm">
                El descuento por tardanzas ya está registrado. Quite esa línea si necesita recalcularlo.
              </p>
            ) : (
              <p className="text-sm">
                Se registrará la línea de descuento <strong>«{v.concepto}»</strong> por{' '}
                {formatoMoneda(v.importe)}.
              </p>
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={props.alCerrar}>
            Cerrar
          </Button>
          <Button
            type="button"
            disabled={!puedeRegistrar || enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await api.post(`${EP}/${props.id}/tardanzas`);
                toast.success('Descuento por tardanzas registrado');
                await props.alRegistrar();
                props.alCerrar();
              } catch (e) {
                toast.error(mensajeDeError(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Registrar descuento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoPago(props: {
  detalle: DetalleLiquidacion;
  alCerrar: () => void;
  alPagar: () => Promise<unknown>;
}) {
  const [abierto, setAbierto] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  // Una clave por intento de pago: si la respuesta se pierde y se reintenta, la base no duplica el pago.
  const [clave] = useState(uuidV4);
  return (
    <DialogoFormulario
      titulo="Registrar pago"
      descripcion={`Saldo de la liquidación: ${formatoMoneda(props.detalle.totales.saldo)}. La base rechaza pagos que excedan el saldo.`}
      esquema={esquemaPago}
      valores={{
        claveIdempotencia: clave,
        importe: props.detalle.totales.saldo ?? '',
        medio: 'transferencia',
        referencia: '',
      }}
      abierto={abierto}
      alCambiarAbierto={(v) => {
        setAbierto(v);
        if (!v) props.alCerrar();
      }}
      alEnviar={async (datos) => {
        await api.post(
          `${EP}/${props.detalle.id}/pagos`,
          cuerpoConArchivo({ ...datos, claveIdempotencia: clave }, archivo),
        );
        await props.alPagar();
      }}
      mensajeExito="Pago registrado"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto nombre="importe" etiqueta="Importe (S/)" tipo="number" paso="0.01" />
        <CampoSelect nombre="medio" etiqueta="Medio" opciones={OPCIONES_MEDIO_PAGO} />
        <CampoTexto
          nombre="referencia"
          etiqueta="Referencia / N.º de operación"
          className="sm:col-span-2"
          descripcion="Opcional"
        />
      </div>
      <CampoArchivo etiqueta="Evidencia (voucher)" archivo={archivo} alCambiar={setArchivo} />
    </DialogoFormulario>
  );
}

function DialogoReversion(props: {
  pago: PagoLiquidacion;
  alCerrar: () => void;
  alRevertir: () => Promise<unknown>;
}) {
  const [abierto, setAbierto] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  return (
    <DialogoFormulario
      titulo={`Revertir pago de ${formatoMoneda(props.pago.importe)}`}
      descripcion="La reversión es definitiva (una por pago) y devuelve el importe al saldo. El pago original se conserva en el historial."
      esquema={esquemaReversion}
      valores={{ motivo: '' }}
      abierto={abierto}
      alCambiarAbierto={(v) => {
        setAbierto(v);
        if (!v) props.alCerrar();
      }}
      alEnviar={async (datos) => {
        await api.post(
          `/api/admin/planilla/pagos/${props.pago.id}/revertir`,
          cuerpoConArchivo(datos, archivo),
        );
        await props.alRevertir();
      }}
      textoEnviar="Revertir pago"
      mensajeExito="Pago revertido"
    >
      <CampoTexto nombre="motivo" etiqueta="Motivo de la reversión" />
      <CampoArchivo etiqueta="Evidencia" archivo={archivo} alCambiar={setArchivo} />
    </DialogoFormulario>
  );
}
