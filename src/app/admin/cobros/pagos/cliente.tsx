'use client';
import { useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, FileDown, FileText, Loader2, Paperclip, Plus, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora, formatoMoneda, hoyLima } from '@/lib/formato';
import {
  ESTADOS_COMPROBANTE,
  ETIQUETA_COMPROBANTE,
  ETIQUETA_MEDIO,
  OPCIONES_MEDIO,
  TIPOS_COMPROBANTE,
  esquemaComprobante,
  esquemaDevolucion,
  type AplicacionDetalle,
  type DetallePago,
  type FilaPago,
} from '@/esquemas/cobros/pagos';
import { descripcionCuota } from '@/esquemas/cobros/cuotas';
import { aCentimos, deCentimos, numeroRecibo } from '@/esquemas/cobros/dinero';

const ENDPOINT = '/api/admin/cobros/pagos';
const ACEPTA = 'application/pdf,image/png,image/jpeg,image/webp';

export function ClientePagos({ puedeCobrar, puedeRevertir }: { puedeCobrar: boolean; puedeRevertir: boolean }) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  return (
    <>
      <EncabezadoPagina
        titulo="Pagos y recibos"
        descripcion="Los pagos y recibos son inmutables: se corrigen con reversión total o devoluciones por cuota, siempre con motivo."
      />
      <TablaDatos<FilaPago>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Alumno, pagante, recibo u operación…"
        filtros={[
          { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
          { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
          { nombre: 'medio', etiqueta: 'Medio', tipo: 'select', opciones: OPCIONES_MEDIO },
          {
            nombre: 'estado',
            etiqueta: 'Estado',
            tipo: 'select',
            opciones: [
              { valor: 'vigente', etiqueta: 'Vigente' },
              { valor: 'revertido', etiqueta: 'Revertido' },
            ],
          },
        ]}
        alSeleccionarFila={(f) => setSeleccionado(f.id)}
        columnas={[
          { clave: 'pagado_en', titulo: 'Fecha', celda: (f) => formatoFechaHora(f.pagado_en) },
          { clave: 'recibo', titulo: 'Recibo', celda: (f) => <span className="font-mono text-xs">{f.recibo_id ? numeroRecibo(f.serie, f.numero) : '—'}</span> },
          {
            clave: 'alumno',
            titulo: 'Alumno',
            celda: (f) => (
              <div className="min-w-0">
                <p className="truncate font-medium">{f.alumno ?? '—'}</p>
                <p className="truncate text-xs text-muted-foreground">Pagó: {f.pagante_nombre}</p>
              </div>
            ),
          },
          { clave: 'medio', titulo: 'Medio', celda: (f) => ETIQUETA_MEDIO[f.medio_ui], ocultarEnMovil: true },
          { clave: 'importe', titulo: 'Importe', celda: (f) => <span className="font-semibold tabular-nums">{formatoMoneda(f.importe)}</span>, className: 'text-right' },
          {
            clave: 'estado',
            titulo: 'Estado',
            celda: (f) => (
              <div className="flex flex-wrap gap-1">
                {f.revertido ? <Etiqueta tono="peligro">Revertido</Etiqueta> : <Etiqueta tono="exito">Vigente</Etiqueta>}
                {aCentimos(f.devuelto) > 0 ? <Etiqueta tono="info">Dev. {formatoMoneda(f.devuelto)}</Etiqueta> : null}
              </div>
            ),
            ocultarEnMovil: true,
          },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Ver pago ${f.id}`} onClick={() => setSeleccionado(f.id)}>
              <Eye aria-hidden />
            </Button>
            {f.recibo_id ? (
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={`${ENDPOINT}/${f.id}/recibo`} download aria-label={`Descargar recibo ${numeroRecibo(f.serie, f.numero)}`}>
                  <FileDown aria-hidden />
                </a>
              </Button>
            ) : null}
          </>
        )}
      />
      <Sheet open={seleccionado !== null} onOpenChange={(v) => !v && setSeleccionado(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {seleccionado ? <DetallePagoPanel pagoId={seleccionado} puedeCobrar={puedeCobrar} puedeRevertir={puedeRevertir} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetallePagoPanel({ pagoId, puedeCobrar, puedeRevertir }: { pagoId: string; puedeCobrar: boolean; puedeRevertir: boolean }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const clave = ['cobros', 'pago', pagoId];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetallePago>(`${ENDPOINT}/${pagoId}`) });
  const [devolviendo, setDevolviendo] = useState<AplicacionDetalle | null>(null);
  const [comprobante, setComprobante] = useState(false);
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await qc.invalidateQueries({ queryKey: ['cobros', 'sesion-actual'] });
    await recargar(ENDPOINT);
  };

  if (consulta.isPending) {
    return (
      <div className="grid gap-3 p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Pago</SheetTitle>
        </SheetHeader>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (consulta.isError) {
    return (
      <div className="p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Pago</SheetTitle>
        </SheetHeader>
        <p role="alert" className="mt-3 rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          {mensajeDeError(consulta.error)}
        </p>
      </div>
    );
  }
  const d = consulta.data;
  const recibo = d.recibo ? numeroRecibo(d.recibo.serie, d.recibo.numero) : null;

  return (
    <div className="grid gap-4 p-4">
      <SheetHeader className="p-0">
        <SheetTitle>{recibo ? `Recibo ${recibo}` : `Pago ${d.id}`}</SheetTitle>
        <SheetDescription>
          {formatoFechaHora(d.pagado_en)} · {formatoMoneda(d.importe)} · {ETIQUETA_MEDIO[d.medio_ui]}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap gap-2">
        {d.reversion ? <Etiqueta tono="peligro">Revertido</Etiqueta> : <Etiqueta tono="exito">Vigente</Etiqueta>}
        {d.recibo ? (
          <Button variant="outline" size="sm" asChild>
            <a href={`${ENDPOINT}/${d.id}/recibo`} download>
              <FileDown aria-hidden /> Recibo PDF
            </a>
          </Button>
        ) : null}
        {puedeRevertir && !d.reversion ? (
          <Confirmar
            titulo="¿Revertir totalmente el pago?"
            descripcion={
              d.devoluciones.length
                ? 'El pago tiene devoluciones registradas: no puede revertirse totalmente.'
                : 'Las cuotas recuperarán su saldo. El pago y el recibo se conservan marcados como revertidos.'
            }
            destructivo
            pedirMotivo
            etiquetaMotivo="Motivo de la reversión"
            textoConfirmar="Revertir"
            mensajeExito="Pago revertido"
            alConfirmar={async (motivo) => {
              await api.post(`${ENDPOINT}/${d.id}/reversion`, { motivo });
              await refrescar();
            }}
            disparador={
              <Button variant="destructive" size="sm" disabled={d.devoluciones.length > 0}>
                <RotateCcw aria-hidden /> Revertir
              </Button>
            }
          />
        ) : null}
      </div>

      {d.reversion ? (
        <p className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          Revertido el {formatoFechaHora(d.reversion.revertido_en)} por {d.reversion.autorizado_por}: {d.reversion.motivo}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Alumno</dt>
          <dd className="font-medium">{d.alumno?.nombre ?? '—'}</dd>
          {d.alumno ? (
            <dd className="text-xs text-muted-foreground">
              {d.alumno.codigo} · {d.alumno.anio} · {d.alumno.grado}
              {d.alumno.seccion ? ` "${d.alumno.seccion}"` : ''}
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-muted-foreground">Pagante</dt>
          <dd className="font-medium">{d.pagante.nombre}</dd>
          <dd className="text-xs text-muted-foreground">{[d.pagante.tipoDocumento, d.pagante.numeroDocumento].filter(Boolean).join(' ') || 'Sin documento'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Referencia</dt>
          <dd>{d.referencia ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Caja / cajero</dt>
          <dd>
            {d.caja ?? 'Sin caja'} · {d.registrado_por}
          </dd>
        </div>
      </dl>

      <Separator />
      <section aria-labelledby="titulo-aplicaciones" className="grid gap-2">
        <h3 id="titulo-aplicaciones" className="font-medium">
          Imputación a cuotas
        </h3>
        <ul className="grid gap-2">
          {d.aplicaciones.map((a) => {
            const disponible = aCentimos(a.importe) - aCentimos(a.devuelto);
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{descripcionCuota(a)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatoMoneda(a.importe)} · {a.imputacion === 'regla' ? 'por regla' : 'elección del pagante'}
                    {aCentimos(a.devuelto) ? ` · devuelto ${formatoMoneda(a.devuelto)}` : ''}
                  </p>
                </div>
                {puedeRevertir && !d.reversion && disponible > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setDevolviendo(a)}>
                    <Undo2 aria-hidden /> Devolver
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {d.devoluciones.length ? (
        <section aria-labelledby="titulo-devoluciones" className="grid gap-2">
          <h3 id="titulo-devoluciones" className="font-medium">
            Devoluciones
          </h3>
          <ul className="grid gap-1 text-sm">
            {d.devoluciones.map((x) => (
              <li key={x.id} className="rounded-md border px-2 py-1">
                {formatoMoneda(x.importe)} · {x.en_efectivo ? 'en efectivo' : 'otro medio'} · {x.motivo}
                <span className="block text-xs text-muted-foreground">
                  {formatoFechaHora(x.devuelto_en)} · {x.autorizado_por}
                  {x.evidencia_id ? (
                    <>
                      {' · '}
                      <a className="underline" href={`/api/admin/cobros/archivos/${x.evidencia_id}`} download>
                        evidencia
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Separator />
      <section aria-labelledby="titulo-comprobantes" className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id="titulo-comprobantes" className="font-medium">
            Comprobantes electrónicos (SUNAT)
          </h3>
          {puedeCobrar ? (
            <Button variant="outline" size="sm" onClick={() => setComprobante(true)}>
              <Plus aria-hidden /> Registrar
            </Button>
          ) : null}
        </div>
        {d.comprobantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin comprobantes asociados.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {d.comprobantes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                <span>
                  <FileText className="mr-1 inline size-4" aria-hidden />
                  {ETIQUETA_COMPROBANTE[c.tipo] ?? c.tipo} {c.serie}-{c.numero} · RUC {c.ruc_emisor} · {formatoFecha(c.emitido_en)} · {c.estado}
                </span>
                {c.archivo_id ? (
                  <a href={`/api/admin/cobros/archivos/${c.archivo_id}`} download aria-label="Descargar comprobante">
                    <Paperclip className="size-4" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DialogoDevolucion pagoId={d.id} aplicacion={devolviendo} alCerrar={() => setDevolviendo(null)} alGuardar={refrescar} />
      <DialogoComprobante pagoId={d.id} abierto={comprobante} alCambiar={setComprobante} alGuardar={refrescar} />
    </div>
  );
}

function DialogoDevolucion(props: { pagoId: string; aplicacion: AplicacionDetalle | null; alCerrar: () => void; alGuardar: () => Promise<void> }) {
  const a = props.aplicacion;
  const disponible = a ? aCentimos(a.importe) - aCentimos(a.devuelto) : 0;
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enEfectivo, setEnEfectivo] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cerrar = () => {
    setImporte('');
    setMotivo('');
    setEnEfectivo(false);
    setArchivo(null);
    props.alCerrar();
  };
  return (
    <Dialog open={a !== null} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Devolución · {a ? descripcionCuota(a) : ''}</DialogTitle>
          <DialogDescription>Disponible para devolver: {formatoMoneda(deCentimos(disponible))}. La cuota recupera el saldo devuelto.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="dev-importe">Importe (S/)</Label>
            <Input id="dev-importe" type="number" min="0" step="0.01" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dev-motivo">Motivo</Label>
            <Textarea id="dev-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="dev-efectivo">
              Devolver en efectivo
              <span className="block text-xs font-normal text-muted-foreground">Sale de su sesión de caja abierta.</span>
            </Label>
            <Switch id="dev-efectivo" checked={enEfectivo} onCheckedChange={setEnEfectivo} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dev-archivo">Evidencia (opcional, PDF o imagen)</Label>
            <Input id="dev-archivo" type="file" accept={ACEPTA} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            disabled={enviando || !importe || motivo.trim().length < 5}
            onClick={async () => {
              const r = esquemaDevolucion.safeParse({ aplicacionId: a?.id, importe, motivo, enEfectivo });
              if (!r.success) {
                toast.error(r.error.issues[0]?.message ?? 'Datos inválidos');
                return;
              }
              const form = new FormData();
              form.set('aplicacionId', r.data.aplicacionId);
              form.set('importe', r.data.importe);
              form.set('motivo', r.data.motivo);
              form.set('enEfectivo', String(r.data.enEfectivo));
              if (archivo) form.set('archivo', archivo);
              setEnviando(true);
              try {
                await api.post(`${ENDPOINT}/${props.pagoId}/devoluciones`, form);
                toast.success('Devolución registrada');
                await props.alGuardar();
                cerrar();
              } catch (e) {
                toast.error(mensajeDeError(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Registrar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoComprobante(props: { pagoId: string; abierto: boolean; alCambiar: (v: boolean) => void; alGuardar: () => Promise<void> }) {
  const inicial = { rucEmisor: '', tipo: 'boleta', serie: '', numero: '', emitidoEn: hoyLima(), estado: 'emitido' };
  const [datos, setDatos] = useState(inicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = (k: keyof typeof inicial) => (e: ChangeEvent<HTMLInputElement>) => setDatos((d) => ({ ...d, [k]: e.target.value }));
  const cerrar = (v: boolean) => {
    if (!v) {
      setDatos(inicial);
      setArchivo(null);
    }
    props.alCambiar(v);
  };
  return (
    <Dialog open={props.abierto} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comprobante electrónico</DialogTitle>
          <DialogDescription>Boleta o factura emitida fuera del sistema (SUNAT) para este pago.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="ce-ruc">RUC del emisor</Label>
            <Input id="ce-ruc" inputMode="numeric" maxLength={11} value={datos.rucEmisor} onChange={campo('rucEmisor')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ce-tipo">Tipo</Label>
            <Select value={datos.tipo} onValueChange={(v) => setDatos((d) => ({ ...d, tipo: v }))}>
              <SelectTrigger id="ce-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_COMPROBANTE.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ETIQUETA_COMPROBANTE[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ce-estado">Estado</Label>
            <Select value={datos.estado} onValueChange={(v) => setDatos((d) => ({ ...d, estado: v }))}>
              <SelectTrigger id="ce-estado" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_COMPROBANTE.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ce-serie">Serie</Label>
            <Input id="ce-serie" maxLength={4} placeholder="B001" value={datos.serie} onChange={campo('serie')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ce-numero">Número</Label>
            <Input id="ce-numero" inputMode="numeric" maxLength={8} value={datos.numero} onChange={campo('numero')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ce-fecha">Fecha de emisión</Label>
            <Input id="ce-fecha" type="date" value={datos.emitidoEn} onChange={campo('emitidoEn')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ce-archivo">Archivo (opcional)</Label>
            <Input id="ce-archivo" type="file" accept={ACEPTA} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button
            disabled={enviando}
            onClick={async () => {
              const r = esquemaComprobante.safeParse(datos);
              if (!r.success) {
                toast.error(r.error.issues[0]?.message ?? 'Datos inválidos');
                return;
              }
              const form = new FormData();
              for (const [k, v] of Object.entries(r.data)) form.set(k, String(v));
              if (archivo) form.set('archivo', archivo);
              setEnviando(true);
              try {
                await api.post(`${ENDPOINT}/${props.pagoId}/comprobantes`, form);
                toast.success('Comprobante registrado');
                await props.alGuardar();
                cerrar(false);
              } catch (e) {
                toast.error(mensajeDeError(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
