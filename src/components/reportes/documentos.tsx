'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormContext, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Ban, Download, FilePlus2, Loader2, PlayCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { useCatalogo } from '@/lib/catalogos';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora, hoyLima } from '@/lib/formato';
import type { OpcionPlantilla } from '@/esquemas/reportes/plantillas';
import {
  ESTADOS_DOCUMENTO,
  FILTROS_TIPO_REPORTE,
  esquemaSolicitudDocumento,
  type DatosSolicitudDocumento,
  type FilaDocumento,
  type ResumenColaDocumentos,
} from '@/esquemas/reportes/documentos';
import { ComboBusqueda } from './combo-busqueda';

const ENDPOINT = '/api/admin/reportes/documentos';
const OPCIONES_ESTADO = ESTADOS_DOCUMENTO.map((e) => ({ valor: e, etiqueta: e.charAt(0).toUpperCase() + e.slice(1) }));

/** UUID v4 generado en el cliente (idempotencia). `randomUUID` no existe fuera de contextos seguros (http en LAN). */
function nuevoUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const TODOS = '__todos__';

/** Select opcional (con opción "Todas") para filtros que pueden quedar vacíos. */
function SelectOpcional(props: { nombre: 'bimestreId' | 'seccionId'; etiqueta: string; opciones: { valor: string; etiqueta: string }[]; textoVacio: string }) {
  const { control } = useFormContext<DatosSolicitudDocumento>();
  return (
    <FormField
      control={control}
      name={props.nombre}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.etiqueta}</FormLabel>
          <Select value={field.value ? String(field.value) : TODOS} onValueChange={(v) => field.onChange(v === TODOS ? undefined : v)}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={TODOS}>{props.textoVacio}</SelectItem>
              {props.opciones.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function etiquetaPlantilla(p: OpcionPlantilla) {
  return `${p.tipo_nombre} · ${p.anio} · ${p.formato.toUpperCase()} v${p.version} — ${p.nombre}`;
}

function bytesLegibles(n: number | null) {
  if (n === null) return '';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Campos dependientes de la plantilla: muestra solo los filtros que admite su tipo. */
function CamposSolicitud({ plantillas }: { plantillas: OpcionPlantilla[] }) {
  const { control, setValue } = useFormContext<DatosSolicitudDocumento>();
  const plantillaId = useWatch({ control, name: 'plantillaId' });
  const plantilla = plantillas.find((p) => p.id === plantillaId);
  const filtros = plantilla ? (FILTROS_TIPO_REPORTE[plantilla.tipo] ?? {}) : {};
  const anioId = plantilla?.anio_id;
  const bimestres = useCatalogo('bimestres', { anioId }, Boolean(anioId && filtros.bimestre));
  const secciones = useCatalogo('secciones', { anioId }, Boolean(anioId && filtros.seccion));
  const [etiquetaMatricula, setEtiquetaMatricula] = useState<string | null>(null);

  useEffect(() => {
    if (!plantilla) return;
    const hoy = hoyLima();
    const hasta = hoy < plantilla.anio_inicio ? plantilla.anio_fin : hoy > plantilla.anio_fin ? plantilla.anio_fin : hoy;
    setValue('desde', plantilla.anio_inicio);
    setValue('hasta', hasta);
    setValue('matriculaId', undefined);
    setValue('seccionId', undefined);
    setValue('bimestreId', undefined);
    setEtiquetaMatricula(null);
  }, [plantilla, setValue]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect
        nombre="plantillaId"
        etiqueta="Plantilla publicada"
        className="sm:col-span-2"
        opciones={plantillas.map((p) => ({ valor: p.id, etiqueta: etiquetaPlantilla(p) }))}
      />
      <CampoTexto nombre="desde" etiqueta="Desde" tipo="date" />
      <CampoTexto nombre="hasta" etiqueta="Hasta (fecha de corte)" tipo="date" />
      {filtros.bimestre === 'requerido' ? <CampoSelect nombre="bimestreId" etiqueta="Bimestre" opciones={bimestres.data ?? []} /> : null}
      {filtros.bimestre === 'opcional' ? (
        <SelectOpcional nombre="bimestreId" etiqueta="Bimestre (opcional)" opciones={bimestres.data ?? []} textoVacio="Sin bimestre" />
      ) : null}
      {filtros.seccion ? <SelectOpcional nombre="seccionId" etiqueta="Sección (opcional)" opciones={secciones.data ?? []} textoVacio="Todas las secciones" /> : null}
      {filtros.matricula && anioId ? (
        <FormField
          control={control}
          name="matriculaId"
          render={({ field, fieldState }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Estudiante (matrícula){filtros.matricula === 'requerido' ? '' : ' — opcional'}</FormLabel>
              <FormControl>
                <ComboBusqueda
                  valor={field.value}
                  etiqueta={etiquetaMatricula}
                  invalido={Boolean(fieldState.error)}
                  placeholder="Buscar por apellidos, nombres o código…"
                  url={(q) => conConsulta(`${ENDPOINT}/matriculas`, { anioId, q })}
                  alCambiar={(o) => {
                    field.onChange(o?.valor);
                    setEtiquetaMatricula(o?.etiqueta ?? null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {plantilla ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Los datos se congelan al solicitar; el archivo se genera en segundo plano. La base valida su permiso y los filtros del tipo.
        </p>
      ) : null}
    </div>
  );
}

function ResumenCola({ r }: { r: ResumenColaDocumentos | undefined }) {
  if (!r) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
      {r.preparado ? (
        <Etiqueta tono="alerta">
          <Loader2 className="mr-1 size-3 animate-spin" aria-hidden /> {r.preparado} en cola
        </Etiqueta>
      ) : (
        <Etiqueta>Cola vacía</Etiqueta>
      )}
      <Etiqueta tono="exito">{r.emitido} emitido(s)</Etiqueta>
      {r.fallido ? <Etiqueta tono="peligro">{r.fallido} fallido(s)</Etiqueta> : null}
      {r.anulado ? <Etiqueta>{r.anulado} anulado(s)</Etiqueta> : null}
    </div>
  );
}

export function ClienteDocumentos() {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const tipos = useCatalogo('tipos-reporte');
  const [uuid, setUuid] = useState(nuevoUuid);
  const [procesando, setProcesando] = useState(false);

  const plantillas = useQuery({
    queryKey: ['reportes', 'plantillas-disponibles'],
    queryFn: async () => (await api.get<{ plantillas: OpcionPlantilla[] }>(`${ENDPOINT}/plantillas`)).plantillas,
  });

  // Sondeo de la cola: rápido mientras haya documentos preparados.
  const resumen = useQuery({
    queryKey: ['reportes', 'resumen-cola'],
    queryFn: () => api.get<ResumenColaDocumentos>(`${ENDPOINT}/resumen`),
    refetchInterval: (q) => (q.state.data?.preparado ? 3_000 : 20_000),
  });
  const firma = useMemo(() => JSON.stringify(resumen.data ?? {}), [resumen.data]);
  useEffect(() => {
    void recargar(ENDPOINT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: ['reportes', 'resumen-cola'] });
    await recargar(ENDPOINT);
  };

  const reintentar = async (f: FilaDocumento) => {
    try {
      await api.post(ENDPOINT, {
        solicitudUuid: nuevoUuid(),
        plantillaId: f.plantilla_id,
        desde: f.parametros.desde,
        hasta: f.parametros.hasta,
        matriculaId: f.parametros.matricula_id,
        seccionId: f.parametros.seccion_id,
        bimestreId: f.parametros.bimestre_id,
      });
      toast.success('Solicitud registrada nuevamente');
      await refrescar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  };

  const sinPlantillas = plantillas.isSuccess && plantillas.data.length === 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes y documentos"
        descripcion="Solicite un documento a partir de una plantilla publicada; se genera en segundo plano y queda disponible para descargar."
        acciones={
          <>
            <Button
              variant="outline"
              disabled={procesando}
              onClick={async () => {
                setProcesando(true);
                try {
                  const r = await api.post<{ procesados: number; emitidos: number; fallidos: number }>(`${ENDPOINT}/procesar`);
                  if (r.procesados === 0) toast.info('No hay documentos en cola');
                  else toast.success(`${r.emitidos} emitido(s)${r.fallidos ? `, ${r.fallidos} fallido(s)` : ''}`);
                  await refrescar();
                } catch (e) {
                  toast.error(mensajeDeError(e));
                } finally {
                  setProcesando(false);
                }
              }}
            >
              {procesando ? <Loader2 className="animate-spin" aria-hidden /> : <PlayCircle aria-hidden />} Procesar ahora
            </Button>
            <DialogoFormulario
              titulo="Solicitar documento"
              esquema={esquemaSolicitudDocumento}
              ancho="lg"
              valores={{ solicitudUuid: uuid, plantillaId: '', desde: '', hasta: '' }}
              alEnviar={async (d) => {
                await api.post(ENDPOINT, d);
                setUuid(nuevoUuid());
                await refrescar();
              }}
              textoEnviar="Solicitar"
              mensajeExito="Documento solicitado: se generará en unos segundos"
              disparador={
                <Button disabled={!plantillas.data?.length}>
                  <FilePlus2 aria-hidden /> Solicitar documento
                </Button>
              }
            >
              <CamposSolicitud plantillas={plantillas.data ?? []} />
            </DialogoFormulario>
          </>
        }
      />
      {sinPlantillas ? (
        <div className="mb-4">
          <EstadoVacio
            titulo="No hay plantillas publicadas para sus permisos"
            descripcion="Un usuario con permiso para configurar reportes debe publicar una plantilla del tipo que necesita."
          />
        </div>
      ) : null}
      <TablaDatos<FilaDocumento>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por plantilla, tipo o UUID…"
        barra={<ResumenCola r={resumen.data} />}
        filtros={[
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO },
          { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: tipos.data ?? [] },
          { nombre: 'propios', etiqueta: 'Solicitante', tipo: 'select', opciones: [{ valor: 'true', etiqueta: 'Solo míos' }] },
        ]}
        columnas={[
          { clave: 'id', titulo: 'N.º', celda: (f) => <span className="tabular-nums">{f.id}</span> },
          {
            clave: 'plantilla',
            titulo: 'Documento',
            celda: (f) => (
              <div className="min-w-44">
                <p className="font-medium">{f.plantilla_nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {f.tipo_nombre} · {f.anio} · {f.formato.toUpperCase()} v{f.plantilla_version}
                </p>
              </div>
            ),
          },
          {
            clave: 'parametros',
            titulo: 'Parámetros',
            ocultarEnMovil: true,
            celda: (f) => (
              <div className="text-xs">
                <p>
                  {formatoFecha(f.parametros.desde)} – {formatoFecha(f.parametros.hasta)}
                </p>
                <p className="text-muted-foreground">
                  {[
                    f.parametros.bimestre_id ? 'con bimestre' : '',
                    f.parametros.seccion_id ? 'por sección' : '',
                    f.parametros.matricula_id ? 'por estudiante' : '',
                    `${f.filas} fila(s)`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ),
          },
          {
            clave: 'estado',
            titulo: 'Estado',
            celda: (f) => (
              <div className="grid max-w-56 gap-0.5">
                <BadgeEstado estado={f.estado} />
                {f.estado === 'fallido' && f.motivo_fallo ? <span className="text-xs text-peligro-foreground">{f.motivo_fallo}</span> : null}
                {f.estado === 'anulado' && f.motivo_anulacion ? <span className="text-xs text-muted-foreground">{f.motivo_anulacion}</span> : null}
                {f.estado === 'emitido' && f.archivo_bytes ? <span className="text-xs text-muted-foreground">{bytesLegibles(f.archivo_bytes)}</span> : null}
              </div>
            ),
          },
          {
            clave: 'solicitado',
            titulo: 'Solicitado',
            ocultarEnMovil: true,
            celda: (f) => (
              <div className="text-xs">
                <p>{formatoFechaHora(f.solicitado_en)}</p>
                <p className="text-muted-foreground">{f.solicitado_por_login ?? '—'}</p>
              </div>
            ),
          },
        ]}
        acciones={(f) => (
          <>
            {f.estado === 'emitido' && f.puedeGestionar ? (
              <>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={`${ENDPOINT}/${f.id}/descargar`} aria-label={`Descargar documento ${f.id}`} download>
                    <Download aria-hidden />
                  </a>
                </Button>
                <Confirmar
                  titulo={`¿Anular el documento N.º ${f.id}?`}
                  descripcion="El documento deja de poder descargarse. La anulación queda registrada con su motivo y no se puede deshacer."
                  destructivo
                  pedirMotivo
                  etiquetaMotivo="Motivo de la anulación"
                  textoConfirmar="Anular"
                  mensajeExito="Documento anulado"
                  alConfirmar={async (motivo) => {
                    await api.post(`${ENDPOINT}/${f.id}/anular`, { motivo });
                    await refrescar();
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label={`Anular documento ${f.id}`}>
                      <Ban aria-hidden />
                    </Button>
                  }
                />
              </>
            ) : null}
            {f.estado === 'fallido' && f.puedeGestionar ? (
              <Button variant="ghost" size="icon-sm" aria-label={`Volver a solicitar el documento ${f.id}`} onClick={() => void reintentar(f)}>
                <RotateCcw aria-hidden />
              </Button>
            ) : null}
            {f.estado === 'preparado' ? <Loader2 className="m-2 size-4 animate-spin text-muted-foreground" aria-label="Generando" /> : null}
          </>
        )}
      />
    </>
  );
}
