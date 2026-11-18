'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, HandCoins, Loader2, LockKeyhole, Pencil, Plus, Undo2, Unlock, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, Indicador } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFechaHora, formatoMoneda } from '@/lib/formato';
import {
  esquemaAbrirSesion,
  esquemaCaja,
  esquemaSerie,
  type ArqueoSesion,
  type FilaCaja,
  type FilaSerie,
  type FilaSesion,
  type SesionActual,
} from '@/esquemas/cobros/caja';
import { aCentimos, deCentimos } from '@/esquemas/cobros/dinero';
import { cn } from '@/lib/utils';

const API = '/api/admin/cobros';
const CLAVE_SESION = ['cobros', 'sesion-actual'] as const;

export function ClienteCaja() {
  return (
    <>
      <EncabezadoPagina
        titulo="Caja"
        descripcion="Abra su sesión de caja para cobrar en efectivo y ciérrela con arqueo. Administre cajas y series de recibos."
      />
      <Tabs defaultValue="sesion">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sesion">Mi sesión</TabsTrigger>
          <TabsTrigger value="sesiones">Sesiones</TabsTrigger>
          <TabsTrigger value="cajas">Cajas</TabsTrigger>
          <TabsTrigger value="series">Series de recibos</TabsTrigger>
        </TabsList>
        <TabsContent value="sesion" className="mt-4">
          <MiSesion />
        </TabsContent>
        <TabsContent value="sesiones" className="mt-4">
          <Sesiones />
        </TabsContent>
        <TabsContent value="cajas" className="mt-4">
          <Cajas />
        </TabsContent>
        <TabsContent value="series" className="mt-4">
          <Series />
        </TabsContent>
      </Tabs>
    </>
  );
}

function MiSesion() {
  const consulta = useQuery({ queryKey: CLAVE_SESION, queryFn: () => api.get<SesionActual>(`${API}/sesiones/actual`), refetchInterval: 60_000 });
  if (consulta.isPending) return <Skeleton className="h-56 w-full" />;
  if (consulta.isError) {
    return (
      <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
        {mensajeDeError(consulta.error)}
      </div>
    );
  }
  const { sesion, arqueo } = consulta.data;
  return sesion && arqueo ? <SesionAbierta sesion={sesion} arqueo={arqueo} /> : <AbrirSesion />;
}

function AbrirSesion() {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const cajas = useCatalogo('cajas');
  const [cajaId, setCajaId] = useState('');
  const [saldo, setSaldo] = useState('0.00');
  const [enviando, setEnviando] = useState(false);
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole className="size-5" aria-hidden /> No tiene una sesión de caja abierta
        </CardTitle>
        <CardDescription>Para cobrar en efectivo abra una sesión indicando el fondo inicial con el que recibe la caja.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="abrir-caja">Caja</Label>
          <Select value={cajaId} onValueChange={setCajaId}>
            <SelectTrigger id="abrir-caja" className="w-full">
              <SelectValue placeholder={cajas.isPending ? 'Cargando…' : 'Seleccione'} />
            </SelectTrigger>
            <SelectContent>
              {(cajas.data ?? []).map((c) => (
                <SelectItem key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cajas.data && cajas.data.length === 0 ? <p className="text-xs text-muted-foreground">Cree una caja en la pestaña «Cajas».</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="abrir-saldo">Saldo inicial (S/)</Label>
          <Input id="abrir-saldo" type="number" min="0" step="0.01" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          disabled={!cajaId || enviando}
          onClick={async () => {
            const r = esquemaAbrirSesion.safeParse({ cajaId, saldoInicial: saldo });
            if (!r.success) {
              toast.error(r.error.issues[0]?.message ?? 'Datos inválidos');
              return;
            }
            setEnviando(true);
            try {
              await api.post(`${API}/sesiones`, r.data);
              toast.success('Sesión de caja abierta');
              await qc.invalidateQueries({ queryKey: CLAVE_SESION });
              await recargar(`${API}/sesiones`);
              await recargar(`${API}/cajas`);
            } catch (e) {
              toast.error(mensajeDeError(e));
            } finally {
              setEnviando(false);
            }
          }}
        >
          {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <Unlock aria-hidden />}
          Abrir sesión
        </Button>
      </CardFooter>
    </Card>
  );
}

function SesionAbierta({ sesion, arqueo }: { sesion: FilaSesion; arqueo: ArqueoSesion }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const [contado, setContado] = useState('');
  const [cierre, setCierre] = useState<ArqueoSesion | null>(null);
  const diferencia = contado && !Number.isNaN(aCentimos(contado)) ? aCentimos(contado) - aCentimos(arqueo.esperado) : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Etiqueta tono="info">Sesión abierta</Etiqueta>
        <span className="font-medium">{sesion.caja}</span>
        <span className="text-muted-foreground">desde {formatoFechaHora(sesion.abierta_en)} · operador {sesion.operador}</span>
        <Button variant="link" size="sm" asChild className="ml-auto">
          <Link href="/admin/cobros/cobrar">
            <HandCoins aria-hidden /> Ir a cobrar
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador titulo="Saldo inicial" valor={formatoMoneda(arqueo.saldo_inicial)} icono={<Wallet className="size-4" aria-hidden />} />
        <Indicador titulo="Efectivo cobrado" valor={formatoMoneda(arqueo.efectivo_cobrado)} detalle={`${arqueo.pagos} pago(s) en la sesión`} icono={<Banknote className="size-4" aria-hidden />} />
        <Indicador titulo="Devoluciones en efectivo" valor={formatoMoneda(arqueo.devoluciones_efectivo)} icono={<Undo2 className="size-4" aria-hidden />} />
        <Indicador titulo="Otros medios" valor={formatoMoneda(arqueo.otros_medios)} detalle="No ingresan a la caja física" />
        <Indicador titulo="Esperado en caja" valor={formatoMoneda(arqueo.esperado)} detalle={aCentimos(arqueo.efectivo_revertido) ? `Excluye ${formatoMoneda(arqueo.efectivo_revertido)} revertido` : 'Inicial + efectivo − devoluciones'} className="border-primary/40" />
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Cerrar con arqueo</CardTitle>
          <CardDescription>Cuente el efectivo de la caja e ingrese el total. La diferencia queda registrada.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="cierre-contado">Saldo contado (S/)</Label>
            <Input id="cierre-contado" type="number" min="0" step="0.01" inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} />
          </div>
          {diferencia !== null ? (
            <p className={cn('text-sm', diferencia === 0 ? 'text-exito-foreground' : 'text-peligro-foreground')} aria-live="polite">
              {diferencia === 0 ? 'Cuadra con lo esperado.' : `${diferencia > 0 ? 'Sobrante' : 'Faltante'} de ${formatoMoneda(deCentimos(Math.abs(diferencia)))}.`}
            </p>
          ) : null}
          {cierre ? (
            <p className="text-sm" role="status">
              Sesión cerrada · esperado {formatoMoneda(cierre.esperado)} · contado {formatoMoneda(cierre.saldo_contado)} · diferencia {formatoMoneda(cierre.diferencia)}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Confirmar
            titulo="¿Cerrar la sesión de caja?"
            descripcion={`Esperado ${formatoMoneda(arqueo.esperado)}; contado ${formatoMoneda(contado || '0')}. Después no podrá cobrar en efectivo hasta abrir otra sesión.`}
            textoConfirmar="Cerrar sesión"
            mensajeExito="Sesión de caja cerrada"
            alConfirmar={async () => {
              const r = await api.post<ArqueoSesion>(`${API}/sesiones/${sesion.id}/cerrar`, { saldoContado: contado || '0' });
              setCierre(r);
              await qc.invalidateQueries({ queryKey: CLAVE_SESION });
              await recargar(`${API}/sesiones`);
              await recargar(`${API}/cajas`);
            }}
            disparador={
              <Button disabled={!contado}>
                <LockKeyhole aria-hidden /> Cerrar sesión
              </Button>
            }
          />
        </CardFooter>
      </Card>
    </div>
  );
}

function Sesiones() {
  return (
    <TablaDatos<FilaSesion>
      endpoint={`${API}/sesiones`}
      claveFila={(f) => f.id}
      buscador={false}
      filtros={[
        {
          nombre: 'estado',
          etiqueta: 'Estado',
          tipo: 'select',
          opciones: [
            { valor: 'abierta', etiqueta: 'Abierta' },
            { valor: 'cerrada', etiqueta: 'Cerrada' },
          ],
        },
        { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
        { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
      ]}
      columnas={[
        { clave: 'caja', titulo: 'Caja', celda: (f) => <span className="font-medium">{f.caja}</span> },
        { clave: 'operador', titulo: 'Operador', ocultarEnMovil: true },
        { clave: 'abierta_en', titulo: 'Apertura', celda: (f) => formatoFechaHora(f.abierta_en) },
        { clave: 'cerrada_en', titulo: 'Cierre', celda: (f) => (f.cerrada_en ? formatoFechaHora(f.cerrada_en) : <BadgeEstado estado="abierto" />), ocultarEnMovil: true },
        { clave: 'esperado', titulo: 'Esperado', celda: (f) => formatoMoneda(f.esperado), className: 'text-right' },
        { clave: 'saldo_contado', titulo: 'Contado', celda: (f) => formatoMoneda(f.saldo_contado), className: 'text-right', ocultarEnMovil: true },
        {
          clave: 'diferencia',
          titulo: 'Diferencia',
          className: 'text-right',
          celda: (f) =>
            f.diferencia === null ? '—' : <Etiqueta tono={aCentimos(f.diferencia) === 0 ? 'exito' : 'peligro'}>{formatoMoneda(f.diferencia)}</Etiqueta>,
        },
      ]}
    />
  );
}

function Cajas() {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const [editando, setEditando] = useState<FilaCaja | null>(null);
  const ep = `${API}/cajas`;
  return (
    <>
      <TablaDatos<FilaCaja>
        endpoint={ep}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar caja…"
        barra={
          <DialogoFormulario
            titulo="Nueva caja"
            esquema={esquemaCaja}
            valores={{ nombre: '', activa: true }}
            alEnviar={async (d) => {
              await api.post(ep, d);
              await recargar(ep);
              await qc.invalidateQueries({ queryKey: ['catalogo'] });
            }}
            mensajeExito="Caja creada"
            disparador={
              <Button size="sm">
                <Plus aria-hidden /> Nueva caja
              </Button>
            }
          >
            <CampoTexto nombre="nombre" etiqueta="Nombre" placeholder="Caja principal" />
            <CampoSwitch nombre="activa" etiqueta="Activa" />
          </DialogoFormulario>
        }
        columnas={[
          { clave: 'nombre', titulo: 'Caja', celda: (f) => <span className="font-medium">{f.nombre}</span> },
          { clave: 'activa', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.activa ? 'activa' : 'inactiva'} /> },
          { clave: 'operador', titulo: 'Sesión abierta', celda: (f) => (f.operador ? `${f.operador} · ${formatoFechaHora(f.abierta_en)}` : '—') },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.nombre}`} onClick={() => setEditando(f)}>
            <Pencil aria-hidden />
          </Button>
        )}
      />
      <DialogoFormulario
        titulo="Editar caja"
        esquema={esquemaCaja}
        valores={editando ? { nombre: editando.nombre, activa: editando.activa } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ep}/${editando?.id}`, d);
          await recargar(ep);
              await qc.invalidateQueries({ queryKey: ['catalogo'] });
        }}
      >
        <CampoTexto nombre="nombre" etiqueta="Nombre" />
        <CampoSwitch nombre="activa" etiqueta="Activa" />
      </DialogoFormulario>
    </>
  );
}

function Series() {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const [editando, setEditando] = useState<FilaSerie | null>(null);
  const ep = `${API}/series`;
  return (
    <>
      <TablaDatos<FilaSerie>
        endpoint={ep}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar serie…"
        barra={
          <DialogoFormulario
            titulo="Nueva serie de recibos"
            descripcion="El correlativo lo asigna la base al emitir cada recibo, con bloqueo, desde el número inicial."
            esquema={esquemaSerie}
            valores={{ codigo: 'REC-', numeroInicial: 1, activa: true }}
            alEnviar={async (d) => {
              await api.post(ep, d);
              await recargar(ep);
              await qc.invalidateQueries({ queryKey: ['catalogo'] });
            }}
            mensajeExito="Serie creada"
            disparador={
              <Button size="sm">
                <Plus aria-hidden /> Nueva serie
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto nombre="codigo" etiqueta="Código" placeholder="REC-001" descripcion="Formato REC-XXX" />
              <CampoTexto nombre="numeroInicial" etiqueta="Número inicial" tipo="number" />
            </div>
            <CampoSwitch nombre="activa" etiqueta="Activa" />
          </DialogoFormulario>
        }
        columnas={[
          { clave: 'codigo', titulo: 'Serie', celda: (f) => <span className="font-mono font-medium">{f.codigo}</span> },
          { clave: 'numero_inicial', titulo: 'Inicial', ocultarEnMovil: true },
          { clave: 'siguiente_numero', titulo: 'Siguiente' },
          { clave: 'recibos', titulo: 'Recibos', ocultarEnMovil: true },
          { clave: 'activa', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.activa ? 'activa' : 'inactiva'} /> },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.codigo}`} onClick={() => setEditando(f)}>
            <Pencil aria-hidden />
          </Button>
        )}
      />
      <DialogoFormulario
        titulo={`Editar serie ${editando?.codigo ?? ''}`}
        descripcion={editando && editando.recibos > 0 ? 'La serie ya emitió recibos: solo puede activarla o desactivarla.' : undefined}
        esquema={esquemaSerie}
        valores={editando ? { codigo: editando.codigo, numeroInicial: Number(editando.numero_inicial), activa: editando.activa } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ep}/${editando?.id}`, d);
          await recargar(ep);
              await qc.invalidateQueries({ queryKey: ['catalogo'] });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="codigo" etiqueta="Código" deshabilitado={Boolean(editando && editando.recibos > 0)} />
          <CampoTexto nombre="numeroInicial" etiqueta="Número inicial" tipo="number" deshabilitado={Boolean(editando && editando.recibos > 0)} />
        </div>
        <CampoSwitch nombre="activa" etiqueta="Activa" />
      </DialogoFormulario>
    </>
  );
}
