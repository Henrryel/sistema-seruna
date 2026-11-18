'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { CalendarPlus, Eye, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { useOpcionesContrato } from '@/components/planilla/opciones';
import { PanelLiquidacion } from '@/components/planilla/panel-liquidacion';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoMes, formatoMoneda, hoyLima } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { NOMBRE_MODALIDAD } from '@/esquemas/planilla/contratos';
import {
  esquemaLiquidacion,
  esquemaPeriodo,
  type FilaLiquidacion,
  type FilaPeriodo,
} from '@/esquemas/planilla/liquidaciones';

const EP_PERIODOS = '/api/admin/planilla/periodos';
const EP_LIQ = '/api/admin/planilla/liquidaciones';
const CLAVE_PERIODOS = ['planilla', 'periodos'] as const;

const OPCIONES_ESTADO = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'aprobada', etiqueta: 'Aprobada' },
];

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface PermisosLiquidacion {
  puedeLiquidar: boolean;
  puedePagar: boolean;
  puedeRevertir: boolean;
}

export function ClienteLiquidaciones(permisos: PermisosLiquidacion) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const periodos = useQuery({
    queryKey: CLAVE_PERIODOS,
    queryFn: () => api.get<{ periodos: FilaPeriodo[] }>(EP_PERIODOS),
  });
  const lista = periodos.data?.periodos ?? [];
  const [periodoId, setPeriodoId] = useState<string | null>(null);
  const periodo = lista.find((p) => p.id === periodoId) ?? lista[0] ?? null;
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [abriendoMes, setAbriendoMes] = useState(false);
  const [creando, setCreando] = useState(false);
  const parametros = useMemo(() => ({ periodoId: periodo?.id }), [periodo?.id]);

  const refrescar = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: CLAVE_PERIODOS }),
      qc.invalidateQueries({ queryKey: ['planilla', 'liquidacion'] }),
      recargar(EP_LIQ),
    ]);
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Liquidaciones docentes"
        descripcion="Planilla mensual por contrato. La base congela las condiciones del contrato, exige incluir todas las horas aprobadas del mes y no permite pagar más que el saldo."
        acciones={
          permisos.puedeLiquidar ? (
            <Button variant="outline" onClick={() => setAbriendoMes(true)}>
              <CalendarPlus aria-hidden /> Abrir mes
            </Button>
          ) : null
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Períodos</CardTitle>
          <CardDescription>Elija un mes para ver sus liquidaciones.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {periodos.isPending ? (
            <Skeleton className="h-14 w-full" />
          ) : periodos.isError ? (
            <p role="alert" className="text-destructive text-sm">
              {mensajeDeError(periodos.error)}
            </p>
          ) : lista.length === 0 ? (
            <EstadoVacio
              titulo="Sin períodos"
              descripcion="Abra el primer mes de planilla para empezar a liquidar."
            />
          ) : (
            <>
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                role="group"
                aria-label="Períodos de planilla"
              >
                {lista.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={periodo?.id === p.id}
                    onClick={() => setPeriodoId(p.id)}
                    className={cn(
                      'hover:bg-accent focus-visible:ring-ring flex shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      periodo?.id === p.id && 'border-primary bg-accent',
                    )}
                  >
                    <span className="font-medium">{mayuscula(formatoMes(p.mes))}</span>
                    <BadgeEstado estado={p.estado} />
                  </button>
                ))}
              </div>
              {periodo ? (
                <ResumenPeriodo
                  periodo={periodo}
                  permisos={permisos}
                  alCrear={() => setCreando(true)}
                  alCambiar={refrescar}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {periodo ? (
        <TablaDatos<FilaLiquidacion>
          endpoint={EP_LIQ}
          parametros={parametros}
          claveFila={(f) => f.id}
          placeholderBusqueda="Docente, código o contrato…"
          filtros={[{ nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO }]}
          alSeleccionarFila={(f) => setSeleccionada(f.id)}
          vacio={
            <EstadoVacio
              titulo="Sin liquidaciones"
              descripcion={`Aún no hay liquidaciones de ${formatoMes(periodo.mes)}.`}
            />
          }
          columnas={[
            {
              clave: 'docente',
              titulo: 'Docente',
              celda: (f) => (
                <div className="min-w-40">
                  <div className="font-medium">{f.docente}</div>
                  <div className="text-muted-foreground text-xs">
                    {f.codigo_docente} · {f.referencia}
                  </div>
                </div>
              ),
            },
            {
              clave: 'modalidad',
              titulo: 'Modalidad',
              celda: (f) => NOMBRE_MODALIDAD[f.modalidad],
              ocultarEnMovil: true,
            },
            { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
            {
              clave: 'neto',
              titulo: 'Neto',
              className: 'text-right',
              celda: (f) => <span className="tabular-nums">{formatoMoneda(f.neto)}</span>,
            },
            {
              clave: 'saldo',
              titulo: 'Saldo',
              className: 'text-right',
              ocultarEnMovil: true,
              celda: (f) =>
                f.saldo === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : Number(f.saldo) <= 0 ? (
                  <Etiqueta tono="exito">Pagado</Etiqueta>
                ) : (
                  <span className="tabular-nums">{formatoMoneda(f.saldo)}</span>
                ),
            },
          ]}
          acciones={(f) => (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ver liquidación de ${f.docente}`}
              onClick={() => setSeleccionada(f.id)}
            >
              <Eye aria-hidden />
            </Button>
          )}
        />
      ) : null}

      <Sheet open={seleccionada !== null} onOpenChange={(v) => !v && setSeleccionada(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {seleccionada ? (
            <PanelLiquidacion
              id={seleccionada}
              {...permisos}
              alCambiar={refrescar}
              alEliminar={async () => {
                setSeleccionada(null);
                await refrescar();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <DialogoFormulario
        titulo="Abrir mes de planilla"
        descripcion="El período nace abierto; se cierra cuando no quedan borradores ni horas pendientes o sin liquidar."
        esquema={esquemaPeriodo}
        valores={{ mes: hoyLima().slice(0, 7) }}
        abierto={abriendoMes}
        alCambiarAbierto={setAbriendoMes}
        alEnviar={async (d) => {
          const r = await api.post<{ id: string }>(EP_PERIODOS, d);
          await qc.invalidateQueries({ queryKey: CLAVE_PERIODOS });
          setPeriodoId(r.id);
        }}
        mensajeExito="Período abierto"
        ancho="sm"
      >
        <CampoTexto nombre="mes" etiqueta="Mes" tipo="month" />
      </DialogoFormulario>

      {creando && periodo ? (
        <DialogoNuevaLiquidacion
          periodo={periodo}
          alCerrar={() => setCreando(false)}
          alCrear={async (id) => {
            await refrescar();
            setSeleccionada(id);
          }}
        />
      ) : null}
    </>
  );
}

function ResumenPeriodo(props: {
  periodo: FilaPeriodo;
  permisos: PermisosLiquidacion;
  alCrear: () => void;
  alCambiar: () => Promise<unknown>;
}) {
  const p = props.periodo;
  const abierto = p.estado === 'abierto';
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-1 text-sm">
        <p className="font-medium">
          {mayuscula(formatoMes(p.mes))} · {abierto ? 'abierto' : `cerrado el ${formatoFecha(p.cerrado_en)}`}
        </p>
        <p className="text-muted-foreground">
          {p.aprobadas} aprobada(s) · {p.borradores} borrador(es) · {p.horas_pendientes} hora(s) pendiente(s)
          · {p.horas_sin_liquidar} hora(s) aprobada(s) sin liquidar
        </p>
      </div>
      {abierto && props.permisos.puedeLiquidar ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={props.alCrear}>
            <Plus aria-hidden /> Nueva liquidación
          </Button>
          <Confirmar
            titulo={`¿Cerrar ${formatoMes(p.mes)}?`}
            descripcion="Cerrado el período no se crean ni aprueban liquidaciones ni horas del mes. La base lo rechaza si quedan borradores u horas pendientes o sin liquidar."
            textoConfirmar="Cerrar período"
            mensajeExito="Período cerrado"
            alConfirmar={async () => {
              await api.post(`${EP_PERIODOS}/${p.id}/cerrar`);
              await props.alCambiar();
            }}
            disparador={
              <Button size="sm" variant="outline">
                <Lock aria-hidden /> Cerrar período
              </Button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function CamposNuevaLiquidacion({ mes }: { mes: string }) {
  const { watch } = useFormContext();
  const contratos = useOpcionesContrato({ mes });
  const contratoId = watch('contratoId') as string | undefined;
  const elegido = contratos.data?.find((c) => c.valor === contratoId);
  const finMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  const parcial = elegido && ((elegido.extra.inicio ?? mes) > mes || (elegido.extra.fin ?? finMes) < finMes);
  return (
    <div className="grid gap-4">
      <CampoSelect
        nombre="contratoId"
        etiqueta="Contrato"
        opciones={contratos.data ?? []}
        placeholder={contratos.isPending ? 'Cargando…' : 'Contratos vigentes en el mes'}
      />
      {elegido?.extra.modalidad === 'por_horas' ? (
        <p className="bg-muted rounded-md px-3 py-2 text-sm">
          Contrato por horas: se incluirán todas las horas aprobadas del mes. Las horas pendientes deben
          resolverse antes de aprobar.
        </p>
      ) : elegido ? (
        <>
          <p
            className={cn(
              'rounded-md px-3 py-2 text-sm',
              parcial ? 'bg-alerta text-alerta-foreground' : 'bg-muted',
            )}
          >
            {parcial
              ? `El contrato no cubre todo el mes (${formatoFecha(elegido.extra.inicio)} – ${formatoFecha(elegido.extra.fin)}): la base exige el importe prorrateado y su motivo.`
              : 'Si deja el importe vacío, la base aplica el sueldo mensual completo del contrato.'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              nombre="importeFijo"
              etiqueta="Importe autorizado (S/)"
              tipo="number"
              paso="0.01"
              descripcion="Solo si es un sueldo parcial"
            />
          </div>
          <CampoArea
            nombre="motivoProrrateo"
            etiqueta="Motivo del prorrateo"
            descripcion="Obligatorio si el importe difiere del sueldo o el contrato no cubre el mes"
          />
        </>
      ) : null}
    </div>
  );
}

function DialogoNuevaLiquidacion(props: {
  periodo: FilaPeriodo;
  alCerrar: () => void;
  alCrear: (id: string) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(true);
  return (
    <DialogoFormulario
      titulo={`Nueva liquidación · ${formatoMes(props.periodo.mes)}`}
      descripcion="Se crea en borrador con las condiciones del contrato congeladas por la base."
      esquema={esquemaLiquidacion}
      valores={{ contratoId: '', periodoId: props.periodo.id, importeFijo: null, motivoProrrateo: null }}
      abierto={abierto}
      alCambiarAbierto={(v) => {
        setAbierto(v);
        if (!v) props.alCerrar();
      }}
      alEnviar={async (d) => {
        const r = await api.post<{ id: string }>(EP_LIQ, d);
        await props.alCrear(r.id);
      }}
      mensajeExito="Liquidación creada en borrador"
      ancho="lg"
    >
      <CamposNuevaLiquidacion mes={props.periodo.mes} />
    </DialogoFormulario>
  );
}
