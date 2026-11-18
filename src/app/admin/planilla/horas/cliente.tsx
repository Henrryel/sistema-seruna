'use client';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Check, Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablaDatos, useRecargarListado, type ColumnaTabla } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { CampoArchivo, cuerpoConArchivo, urlArchivo } from '@/components/planilla/campo-archivo';
import { useOpcionesContrato, useSesionesRealizadas } from '@/components/planilla/opciones';
import { api } from '@/lib/api';
import { formatoFecha, hoyLima } from '@/lib/formato';
import { esquemaHora, OPCIONES_ESTADO_HORA, textoMinutos, type FilaHora } from '@/esquemas/planilla/horas';

const ENDPOINT = '/api/admin/planilla/horas';
const SIN_SESION = '__sin_sesion__';
// Constante (no literal en el render): TablaDatos reinicia la página cuando cambian sus parámetros.
const SOLO_PENDIENTES = { estado: 'pendiente' };

export function ClienteHoras({
  puedeRegistrar,
  puedeResolver,
}: {
  puedeRegistrar: boolean;
  puedeResolver: boolean;
}) {
  const recargar = useRecargarListado();
  const [registrando, setRegistrando] = useState(false);
  const [pestana, setPestana] = useState(puedeResolver ? 'pendientes' : 'todas');

  const columnas: ColumnaTabla<FilaHora>[] = [
    {
      clave: 'fecha',
      titulo: 'Fecha',
      celda: (f) => (
        <div className="min-w-24 tabular-nums">
          <div className="font-medium">{formatoFecha(f.fecha)}</div>
          <div className="text-muted-foreground text-xs">
            {f.hora_inicio}–{f.hora_fin} · {textoMinutos(f.minutos)}
          </div>
        </div>
      ),
    },
    {
      clave: 'docente',
      titulo: 'Docente',
      celda: (f) => (
        <div className="min-w-40">
          <div>{f.docente}</div>
          <div className="text-muted-foreground text-xs">{f.referencia}</div>
        </div>
      ),
    },
    {
      clave: 'motivo',
      titulo: 'Motivo',
      ocultarEnMovil: true,
      celda: (f) => (
        <div className="max-w-72 text-sm">
          <p className="line-clamp-2">{f.motivo}</p>
          {f.sesion ? <p className="text-muted-foreground text-xs">Sesión: {f.sesion}</p> : null}
          {f.evidencia_id ? (
            <a
              className="text-primary inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
              href={urlArchivo(f.evidencia_id)}
            >
              <Paperclip className="size-3" aria-hidden /> Evidencia
            </a>
          ) : null}
        </div>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (f) => (
        <div className="grid gap-1">
          <BadgeEstado estado={f.estado} />
          {f.decision ? <span className="text-muted-foreground max-w-48 text-xs">{f.decision}</span> : null}
          {f.liquidacion_id ? (
            <span className="text-muted-foreground text-xs">Liquidada (N.º {f.liquidacion_id})</span>
          ) : null}
        </div>
      ),
    },
  ];

  const acciones = puedeResolver
    ? (f: FilaHora) =>
        f.estado === 'pendiente' ? (
          <>
            <Confirmar
              titulo="¿Aprobar estas horas?"
              descripcion={`${f.docente} · ${formatoFecha(f.fecha)} ${f.hora_inicio}–${f.hora_fin} (${textoMinutos(f.minutos)}). La base exige que el período del mes esté abierto.`}
              pedirMotivo
              etiquetaMotivo="Decisión (sustento)"
              textoConfirmar="Aprobar"
              mensajeExito="Horas aprobadas"
              alConfirmar={async (decision) => {
                await api.post(`${ENDPOINT}/${f.id}/resolver`, { estado: 'aprobada', decision });
                await recargar(ENDPOINT);
              }}
              disparador={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Aprobar horas del ${formatoFecha(f.fecha)} de ${f.docente}`}
                >
                  <Check aria-hidden />
                </Button>
              }
            />
            <Confirmar
              titulo="¿Rechazar estas horas?"
              descripcion={`${f.docente} · ${formatoFecha(f.fecha)} ${f.hora_inicio}–${f.hora_fin}. La decisión queda registrada y no se puede cambiar.`}
              pedirMotivo
              etiquetaMotivo="Motivo del rechazo"
              destructivo
              textoConfirmar="Rechazar"
              mensajeExito="Horas rechazadas"
              alConfirmar={async (decision) => {
                await api.post(`${ENDPOINT}/${f.id}/resolver`, { estado: 'rechazada', decision });
                await recargar(ENDPOINT);
              }}
              disparador={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rechazar horas del ${formatoFecha(f.fecha)} de ${f.docente}`}
                >
                  <X aria-hidden />
                </Button>
              }
            />
          </>
        ) : null
    : undefined;

  return (
    <>
      <EncabezadoPagina
        titulo="Horas docentes"
        descripcion="Horas trabajadas en contratos por horas. Solo se registran horas ya trabajadas; cada registro se aprueba o rechaza una sola vez."
        acciones={
          puedeRegistrar ? (
            <Button onClick={() => setRegistrando(true)}>
              <Plus aria-hidden /> Registrar horas
            </Button>
          ) : null
        }
      />
      <Tabs value={pestana} onValueChange={setPestana}>
        <TabsList className="mb-3">
          <TabsTrigger value="pendientes">Bandeja de pendientes</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes">
          <TablaDatos<FilaHora>
            endpoint={ENDPOINT}
            parametros={SOLO_PENDIENTES}
            claveFila={(f) => f.id}
            placeholderBusqueda="Docente, contrato o motivo…"
            columnas={columnas}
            acciones={acciones}
            vacio={<EstadoVacio titulo="Sin horas pendientes" descripcion="No hay horas por resolver." />}
          />
        </TabsContent>
        <TabsContent value="todas">
          <TablaDatos<FilaHora>
            endpoint={ENDPOINT}
            claveFila={(f) => f.id}
            placeholderBusqueda="Docente, contrato o motivo…"
            filtros={[
              { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO_HORA },
              { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
              { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
            ]}
            columnas={columnas}
            acciones={acciones}
          />
        </TabsContent>
      </Tabs>
      {registrando ? (
        <DialogoRegistrarHoras alCerrar={() => setRegistrando(false)} alGuardar={() => recargar(ENDPOINT)} />
      ) : null}
    </>
  );
}

function CampoSesion() {
  const { control, watch, getValues, setValue } = useFormContext();
  const contratoId = watch('contratoId') as string | undefined;
  const fecha = watch('fecha') as string | undefined;
  const sesiones = useSesionesRealizadas(contratoId, fecha);
  const opciones = sesiones.data ?? [];
  return (
    <FormField
      control={control}
      name="sesionId"
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel>Sesión de clase realizada</FormLabel>
          <Select
            value={field.value ? String(field.value) : SIN_SESION}
            onValueChange={(v) => {
              if (v === SIN_SESION) {
                field.onChange('');
                return;
              }
              field.onChange(v);
              const s = opciones.find((o) => o.valor === v);
              if (s && !getValues('horaInicio')) setValue('horaInicio', s.extra.horaInicio);
              if (s && !getValues('horaFin')) setValue('horaFin', s.extra.horaFin);
            }}
            disabled={!contratoId || !fecha}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin sesión" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={SIN_SESION}>Sin sesión vinculada</SelectItem>
              {opciones.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            Opcional. Si la vincula, la base exige que la sesión esté realizada por el mismo docente y
            contenga el horario.
            {contratoId && fecha && !sesiones.isPending && opciones.length === 0
              ? ' No hay sesiones realizadas ese día.'
              : ''}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function CamposHoras() {
  const contratos = useOpcionesContrato({ modalidad: 'por_horas' });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect
        nombre="contratoId"
        etiqueta="Contrato por horas"
        className="sm:col-span-2"
        opciones={contratos.data ?? []}
        placeholder={contratos.isPending ? 'Cargando…' : 'Seleccione el contrato'}
      />
      <CampoTexto nombre="fecha" etiqueta="Fecha trabajada" tipo="date" className="sm:col-span-2" />
      <CampoSesion />
      <CampoTexto nombre="horaInicio" etiqueta="Hora de inicio" tipo="time" />
      <CampoTexto nombre="horaFin" etiqueta="Hora de fin" tipo="time" />
      <CampoArea
        nombre="motivo"
        etiqueta="Motivo / actividad"
        className="sm:col-span-2"
        placeholder="Reemplazo, taller, reforzamiento…"
      />
    </div>
  );
}

function DialogoRegistrarHoras({
  alCerrar,
  alGuardar,
}: {
  alCerrar: () => void;
  alGuardar: () => Promise<unknown>;
}) {
  const [abierto, setAbierto] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  return (
    <DialogoFormulario
      titulo="Registrar horas trabajadas"
      descripcion="Quedan pendientes hasta que un responsable las apruebe o rechace."
      esquema={esquemaHora}
      valores={{
        contratoId: '',
        fecha: hoyLima(),
        horaInicio: '',
        horaFin: '',
        motivo: '',
        sesionId: undefined,
      }}
      abierto={abierto}
      alCambiarAbierto={(v) => {
        setAbierto(v);
        if (!v) alCerrar();
      }}
      alEnviar={async (d) => {
        await api.post(ENDPOINT, cuerpoConArchivo(d, archivo));
        await alGuardar();
      }}
      mensajeExito="Horas registradas como pendientes"
      ancho="lg"
    >
      <CamposHoras />
      <CampoArchivo etiqueta="Evidencia" archivo={archivo} alCambiar={setArchivo} />
    </DialogoFormulario>
  );
}
