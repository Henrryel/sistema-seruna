'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarCheck, CalendarPlus, CalendarX, Pencil, Sparkles, Sun, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta, type Tono } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio, Indicador } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio } from '@/components/academico/selectores';
import { api, conConsulta } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, NOMBRE_DIA_ISO } from '@/lib/formato';
import {
  esquemaActualizarDia,
  esquemaDiaCalendario,
  esquemaGenerarLectivos,
  NOMBRE_TIPO_DIA,
  TIPOS_DIA,
  type FilaDiaCalendario,
  type ResumenCalendario,
} from '@/esquemas/academico/calendario';

const ENDPOINT = '/api/admin/academico/calendario';
const OPCIONES_TIPO = TIPOS_DIA.map((t) => ({ valor: t, etiqueta: NOMBRE_TIPO_DIA[t] ?? t }));
const TONO: Record<string, Tono> = { lectivo: 'exito', feriado: 'peligro', no_lectivo: 'alerta' };

function CamposDia({ conFecha }: { conFecha: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {conFecha ? <CampoTexto nombre="fecha" etiqueta="Fecha" tipo="date" /> : null}
      <CampoSelect nombre="tipo" etiqueta="Tipo de día" opciones={OPCIONES_TIPO} />
      <CampoTexto nombre="descripcion" etiqueta="Descripción" placeholder="Ej.: Día del Maestro" descripcion="Opcional" className="sm:col-span-2" />
    </div>
  );
}

export function ClienteCalendario() {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const [anioId, setAnioId] = useState<string | undefined>();
  const [editando, setEditando] = useState<FilaDiaCalendario | null>(null);
  // Objeto estable: TablaDatos vuelve a la página 1 cuando cambian sus parámetros.
  const parametros = useMemo(() => ({ anioId }), [anioId]);
  const anios = useCatalogo('anios');
  const anio = anios.data?.find((a) => a.valor === anioId);
  const inicio = String(anio?.extra?.inicio ?? '');
  const fin = String(anio?.extra?.fin ?? '');

  const resumen = useQuery({
    queryKey: ['calendario-resumen', anioId],
    queryFn: () => api.get<ResumenCalendario>(conConsulta(`${ENDPOINT}/resumen`, { anioId })),
    enabled: Boolean(anioId),
  });
  const refrescar = async () => {
    await Promise.all([recargar(ENDPOINT), qc.invalidateQueries({ queryKey: ['calendario-resumen', anioId] })]);
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Calendario escolar"
        descripcion="Días lectivos, feriados y no lectivos del año. La generación de sesiones de clase omite los días no lectivos."
        acciones={
          anioId ? (
            <>
              <DialogoFormulario
                titulo="Generar días lectivos"
                descripcion="Registra como lectivos los lunes a viernes del rango. Los días ya registrados (feriados, no lectivos) no se modifican."
                esquema={esquemaGenerarLectivos}
                valores={{ anioId, desde: inicio, hasta: fin, descripcion: '' }}
                textoEnviar="Generar"
                mensajeExito="Calendario actualizado"
                alEnviar={async (d) => {
                  const r = await api.post<{ creados: number }>(`${ENDPOINT}/generar`, d);
                  await refrescar();
                  toast.info(r.creados ? `Se registraron ${r.creados} día(s) lectivo(s).` : 'No había días hábiles nuevos en el rango.');
                }}
                disparador={
                  <Button variant="outline">
                    <Sparkles aria-hidden /> Generar lectivos
                  </Button>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoTexto nombre="desde" etiqueta="Desde" tipo="date" />
                  <CampoTexto nombre="hasta" etiqueta="Hasta" tipo="date" />
                  <CampoTexto nombre="descripcion" etiqueta="Descripción" descripcion="Opcional" className="sm:col-span-2" />
                </div>
              </DialogoFormulario>
              <DialogoFormulario
                titulo="Registrar día"
                esquema={esquemaDiaCalendario}
                valores={{ anioId, fecha: inicio, tipo: 'feriado', descripcion: '' }}
                mensajeExito="Día registrado"
                alEnviar={async (d) => {
                  await api.post(ENDPOINT, d);
                  await refrescar();
                }}
                disparador={
                  <Button>
                    <CalendarPlus aria-hidden /> Registrar día
                  </Button>
                }
              >
                <CamposDia conFecha />
              </DialogoFormulario>
            </>
          ) : null
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SelectorAnio valor={anioId} alCambiar={setAnioId} />
        {anio ? (
          <p className="text-sm text-muted-foreground">
            Año escolar del {formatoFecha(inicio)} al {formatoFecha(fin)}
          </p>
        ) : null}
      </div>
      {!anioId ? (
        anios.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <EstadoVacio titulo="Sin año seleccionado" descripcion="Registre un año académico en «Años y bimestres» para configurar su calendario." />
        )
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Indicador titulo="Días lectivos" valor={resumen.data?.lectivo ?? '—'} icono={<CalendarCheck className="size-4" aria-hidden />} />
            <Indicador titulo="Feriados" valor={resumen.data?.feriado ?? '—'} icono={<Sun className="size-4" aria-hidden />} />
            <Indicador titulo="No lectivos" valor={resumen.data?.no_lectivo ?? '—'} icono={<CalendarX className="size-4" aria-hidden />} />
          </div>
          <TablaDatos<FilaDiaCalendario>
            endpoint={ENDPOINT}
            parametros={parametros}
            claveFila={(f) => f.fecha}
            placeholderBusqueda="Buscar en la descripción…"
            porPagina={31}
            filtros={[
              { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: OPCIONES_TIPO },
              { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
              { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
            ]}
            vacio={<EstadoVacio titulo="Calendario vacío" descripcion="Use «Generar lectivos» para registrar los días hábiles y luego marque feriados." />}
            columnas={[
              {
                clave: 'fecha',
                titulo: 'Fecha',
                celda: (f) => (
                  <span className="tabular-nums">
                    <span className="font-medium">{formatoFecha(f.fecha)}</span>{' '}
                    <span className="text-muted-foreground">{NOMBRE_DIA_ISO[f.dia_semana]}</span>
                  </span>
                ),
              },
              { clave: 'tipo', titulo: 'Tipo', celda: (f) => <Etiqueta tono={TONO[f.tipo] ?? 'neutro'}>{NOMBRE_TIPO_DIA[f.tipo] ?? f.tipo}</Etiqueta> },
              { clave: 'descripcion', titulo: 'Descripción', ocultarEnMovil: true, celda: (f) => f.descripcion ?? '—' },
            ]}
            acciones={(f) => (
              <>
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${formatoFecha(f.fecha)}`} onClick={() => setEditando(f)}>
                  <Pencil aria-hidden />
                </Button>
                <Confirmar
                  titulo={`¿Quitar el ${formatoFecha(f.fecha)} del calendario?`}
                  descripcion="El día dejará de estar registrado como lectivo, feriado o no lectivo."
                  destructivo
                  textoConfirmar="Quitar"
                  mensajeExito="Día quitado"
                  alConfirmar={async () => {
                    await api.delete(`${ENDPOINT}/${f.anio_id}/${f.fecha}`);
                    await refrescar();
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${formatoFecha(f.fecha)}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                />
              </>
            )}
          />
        </>
      )}
      <DialogoFormulario
        titulo={`Editar ${formatoFecha(editando?.fecha)}`}
        esquema={esquemaActualizarDia}
        valores={editando ? { tipo: editando.tipo as 'lectivo', descripcion: editando.descripcion ?? '' } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${editando?.anio_id}/${editando?.fecha}`, d);
          await refrescar();
        }}
      >
        <CamposDia conFecha={false} />
      </DialogoFormulario>
    </>
  );
}
