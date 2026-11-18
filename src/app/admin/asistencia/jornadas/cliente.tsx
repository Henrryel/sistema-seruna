'use client';
import { useMemo, useState } from 'react';
import { Ban, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoHora } from '@/lib/formato';
import { esquemaPolitica, type DatosPolitica, type FilaJornada, type FilaPolitica, type TipoJornada } from '@/esquemas/asistencia/configuracion';
import { GenerarJornadas } from './generar';

const EP_POLITICAS = '/api/admin/asistencia/politicas';
const EP_JORNADAS = '/api/admin/asistencia/jornadas';
const OPCIONES_ALCANCE = [
  { valor: 'alumno', etiqueta: 'Alumnos' },
  { valor: 'docente', etiqueta: 'Docentes' },
];

function CamposPolitica() {
  const anios = useCatalogo('anios');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="anioId" etiqueta="Año académico" opciones={anios.data ?? []} />
      <CampoSelect nombre="alcance" etiqueta="Alcance" opciones={OPCIONES_ALCANCE} />
      <CampoTexto nombre="turno" etiqueta="Turno" placeholder="Mañana" descripcion="Para alumnos, use el mismo texto que el turno de las secciones." className="sm:col-span-2" />
      <CampoTexto nombre="vigenciaInicio" etiqueta="Vigente desde" tipo="date" />
      <CampoTexto nombre="vigenciaFin" etiqueta="Vigente hasta" tipo="date" />
      <CampoTexto nombre="toleranciaMinutos" etiqueta="Tolerancia (min)" tipo="number" descripcion="Entrada después de hora + tolerancia = tarde." />
      <div className="hidden sm:block" />
      <CampoTexto nombre="ventanaEntradaMinutos" etiqueta="Ventana de entrada (min)" tipo="number" descripcion="Minutos antes de la hora de entrada en que se acepta el QR." />
      <CampoTexto nombre="ventanaSalidaMinutos" etiqueta="Ventana de salida (min)" tipo="number" descripcion="Minutos después de la hora de salida en que se acepta el QR." />
      <CampoSwitch nombre="admiteQr" etiqueta="Admite QR" />
      <CampoSwitch
        nombre="admiteManual"
        etiqueta="Admite manual"
        descripcion="Necesario para registrar presencia sin marcación y para sincronizar lecturas hechas sin conexión."
      />
    </div>
  );
}

function aDatos(p: FilaPolitica): Partial<DatosPolitica> {
  return {
    anioId: p.anio_id,
    alcance: p.alcance,
    turno: p.turno,
    vigenciaInicio: p.vigencia_inicio ?? '',
    vigenciaFin: p.vigencia_fin ?? '',
    admiteQr: p.admite_qr,
    admiteManual: p.admite_manual,
    toleranciaMinutos: p.tolerancia_minutos,
    ventanaEntradaMinutos: p.ventana_entrada_minutos,
    ventanaSalidaMinutos: p.ventana_salida_minutos,
  };
}

function PestanaPoliticas() {
  const recargar = useRecargarListado();
  const anios = useCatalogo('anios');
  const [editando, setEditando] = useState<FilaPolitica | null>(null);
  const anioAbierto = anios.data?.find((a) => a.extra?.estado === 'abierto') ?? anios.data?.[0];
  return (
    <>
      <TablaDatos<FilaPolitica>
        endpoint={EP_POLITICAS}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar turno…"
        filtros={[
          { nombre: 'anioId', etiqueta: 'Año', tipo: 'select', opciones: anios.data ?? [] },
          { nombre: 'alcance', etiqueta: 'Alcance', tipo: 'select', opciones: OPCIONES_ALCANCE },
        ]}
        barra={
          <DialogoFormulario
            titulo="Nueva política de asistencia"
            descripcion="No puede superponerse con otra del mismo año, alcance y turno (la base lo valida)."
            esquema={esquemaPolitica}
            ancho="lg"
            valores={{
              anioId: anioAbierto?.valor,
              alcance: 'alumno',
              turno: 'Mañana',
              vigenciaInicio: String(anioAbierto?.extra?.inicio ?? ''),
              vigenciaFin: String(anioAbierto?.extra?.fin ?? ''),
              admiteQr: true,
              admiteManual: true,
              toleranciaMinutos: 10,
              ventanaEntradaMinutos: 60,
              ventanaSalidaMinutos: 60,
            }}
            alEnviar={async (d) => {
              await api.post(EP_POLITICAS, d);
              await recargar(EP_POLITICAS);
            }}
            mensajeExito="Política creada"
            disparador={
              <Button size="sm">
                <Plus aria-hidden /> Nueva política
              </Button>
            }
          >
            <CamposPolitica />
          </DialogoFormulario>
        }
        columnas={[
          {
            clave: 'turno',
            titulo: 'Política',
            celda: (f) => (
              <div>
                <p className="font-medium">
                  {f.turno} · {f.alcance === 'alumno' ? 'Alumnos' : 'Docentes'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {f.anio} · {formatoFecha(f.vigencia_inicio)} – {formatoFecha(f.vigencia_fin)}
                </p>
              </div>
            ),
          },
          {
            clave: 'metodos',
            titulo: 'Métodos',
            celda: (f) => (
              <span className="flex flex-wrap gap-1">
                {f.admite_qr ? <Etiqueta tono="info">QR</Etiqueta> : null}
                {f.admite_manual ? <Etiqueta>Manual</Etiqueta> : null}
              </span>
            ),
          },
          { clave: 'tolerancia', titulo: 'Tolerancia', celda: (f) => `${f.tolerancia_minutos} min` },
          { clave: 'ventanas', titulo: 'Ventanas (entrada/salida)', celda: (f) => `${f.ventana_entrada_minutos} / ${f.ventana_salida_minutos} min`, ocultarEnMovil: true },
          { clave: 'jornadas', titulo: 'Jornadas', celda: (f) => f.jornadas.toLocaleString('es-PE'), ocultarEnMovil: true },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar política ${f.turno}`} onClick={() => setEditando(f)}>
            <Pencil aria-hidden />
          </Button>
        )}
      />
      <DialogoFormulario
        titulo="Editar política"
        descripcion="Los cambios de tolerancia o ventanas rigen para los registros que se hagan desde ahora."
        esquema={esquemaPolitica}
        ancho="lg"
        valores={editando ? aDatos(editando) : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${EP_POLITICAS}/${editando?.id}`, d);
          await recargar(EP_POLITICAS);
        }}
      >
        <CamposPolitica />
      </DialogoFormulario>
    </>
  );
}

function TablaJornadas({ tipo }: { tipo: TipoJornada }) {
  const recargar = useRecargarListado();
  const anios = useCatalogo('anios');
  const parametros = useMemo(() => ({ tipo }), [tipo]);
  return (
    <TablaDatos<FilaJornada>
      endpoint={EP_JORNADAS}
      parametros={parametros}
      claveFila={(f) => `${f.tipo}-${f.id}`}
      placeholderBusqueda={tipo === 'seccion' ? 'Buscar sección…' : 'Buscar docente…'}
      filtros={[
        { nombre: 'anioId', etiqueta: 'Año', tipo: 'select', opciones: anios.data ?? [] },
        { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
        { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
        {
          nombre: 'estado',
          etiqueta: 'Estado',
          tipo: 'select',
          opciones: [
            { valor: 'programada', etiqueta: 'Programadas' },
            { valor: 'cancelada', etiqueta: 'Canceladas' },
          ],
        },
      ]}
      columnas={[
        { clave: 'fecha', titulo: 'Fecha', celda: (f) => formatoFecha(f.fecha) },
        { clave: 'destino', titulo: tipo === 'seccion' ? 'Sección' : 'Docente', celda: (f) => <span className="font-medium">{f.destino}</span> },
        { clave: 'horario', titulo: 'Horario', celda: (f) => `${formatoHora(f.entrada)}–${formatoHora(f.salida)}` },
        { clave: 'politica', titulo: 'Política', celda: (f) => f.politica, ocultarEnMovil: true },
        { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
        { clave: 'registros', titulo: 'Registros', celda: (f) => f.registros, ocultarEnMovil: true },
      ]}
      acciones={(f) =>
        f.estado === 'programada' ? (
          <Confirmar
            titulo="¿Cancelar la jornada?"
            descripcion={`${f.destino}, ${formatoFecha(f.fecha)}. Deja de esperarse asistencia ese día; los registros existentes se conservan.`}
            destructivo
            pedirMotivo
            etiquetaMotivo="Motivo (p. ej., suspensión de clases)"
            textoConfirmar="Cancelar jornada"
            mensajeExito="Jornada cancelada"
            alConfirmar={async (motivo) => {
              await api.post(`${EP_JORNADAS}/cancelar`, { tipo: f.tipo, id: f.id, motivo });
              await recargar(EP_JORNADAS);
            }}
            disparador={
              <Button variant="ghost" size="icon-sm" aria-label={`Cancelar jornada de ${f.destino} del ${formatoFecha(f.fecha)}`}>
                <Ban aria-hidden />
              </Button>
            }
          />
        ) : null
      }
    />
  );
}

export function ClienteJornadas() {
  const recargar = useRecargarListado();
  return (
    <>
      <EncabezadoPagina
        titulo="Políticas y jornadas"
        descripcion="La política define tolerancia, ventanas y métodos admitidos; la jornada es el horario de cada sección o docente por fecha."
        acciones={
          <GenerarJornadas
            alGenerar={async () => {
              await recargar(EP_JORNADAS);
              await recargar(EP_POLITICAS);
            }}
          />
        }
      />
      <Tabs defaultValue="politicas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="politicas">Políticas</TabsTrigger>
          <TabsTrigger value="secciones">Jornadas de secciones</TabsTrigger>
          <TabsTrigger value="docentes">Jornadas de docentes</TabsTrigger>
        </TabsList>
        <TabsContent value="politicas">
          <PestanaPoliticas />
        </TabsContent>
        <TabsContent value="secciones">
          <TablaJornadas tipo="seccion" />
        </TabsContent>
        <TabsContent value="docentes">
          <TablaJornadas tipo="docente" />
        </TabsContent>
      </Tabs>
    </>
  );
}
