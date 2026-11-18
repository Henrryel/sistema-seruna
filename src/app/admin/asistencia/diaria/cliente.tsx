'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { RegistroAlumnos } from '@/components/asistencia/registro-alumnos';
import { ListaSesiones } from '@/components/asistencia/lista-sesiones';
import { api, conConsulta } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoHora, hoyLima } from '@/lib/formato';
import {
  ESTADOS_ASISTENCIA,
  ESTADOS_MANUALES,
  ETIQUETA_ESTADO,
  esquemaRegistroDocente,
  type FilaAsistenciaDocente,
  type FilaSesion,
} from '@/esquemas/asistencia/registro';

const ENDPOINT_DOCENTES = '/api/admin/asistencia/docentes';

function Selector(props: { id: string; etiqueta: string; valor: string; alCambiar: (v: string) => void; opciones: { valor: string; etiqueta: string }[]; cargando?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{props.etiqueta}</Label>
      <Select value={props.valor || undefined} onValueChange={props.alCambiar} disabled={props.cargando}>
        <SelectTrigger id={props.id} className="w-full">
          <SelectValue placeholder={props.cargando ? 'Cargando…' : 'Seleccione'} />
        </SelectTrigger>
        <SelectContent>
          {props.opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Año + sección + fecha compartidos por las pestañas de alumnos. */
function useFiltrosSeccion() {
  const anios = useCatalogo('anios');
  const [anioElegido, setAnioId] = useState('');
  const anioId = anioElegido || (anios.data?.find((a) => a.extra?.estado === 'abierto') ?? anios.data?.[0])?.valor || '';
  const secciones = useCatalogo('secciones', { anioId }, Boolean(anioId));
  const [seccionId, setSeccionId] = useState('');
  const [fecha, setFecha] = useState(hoyLima());
  const controles = (
    <div className="grid gap-3 sm:grid-cols-3">
      <Selector
        id="anio"
        etiqueta="Año académico"
        valor={anioId}
        alCambiar={(v) => {
          setAnioId(v);
          setSeccionId('');
        }}
        opciones={anios.data ?? []}
        cargando={anios.isPending}
      />
      <Selector id="seccion" etiqueta="Sección" valor={seccionId} alCambiar={setSeccionId} opciones={secciones.data ?? []} cargando={Boolean(anioId) && secciones.isPending} />
      <div className="grid gap-1.5">
        <Label htmlFor="fecha">Fecha</Label>
        <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
    </div>
  );
  return { seccionId, fecha, controles };
}

function PestanaSeccion() {
  const { seccionId, fecha, controles } = useFiltrosSeccion();
  return (
    <div className="grid gap-4">
      {controles}
      {seccionId && fecha ? (
        <RegistroAlumnos key={`${seccionId}-${fecha}`} modo="diaria" endpoint="/api/admin/asistencia/diaria" parametros={{ seccionId, fecha }} />
      ) : (
        <EstadoVacio titulo="Elija sección y fecha" descripcion="Se muestra la nómina esperada de la jornada con su estado (vista de la base)." />
      )}
    </div>
  );
}

function PestanaSesion() {
  const { seccionId, fecha, controles } = useFiltrosSeccion();
  const [sesionId, setSesionId] = useState('');
  const sesiones = useQuery({
    queryKey: ['admin-sesiones', seccionId, fecha],
    queryFn: () => api.get<{ sesiones: FilaSesion[] }>(conConsulta('/api/admin/asistencia/sesiones', { seccionId, fecha })),
    enabled: Boolean(seccionId && fecha),
  });
  return (
    <div className="grid gap-4">
      {controles}
      {seccionId && fecha ? (
        <ListaSesiones sesiones={sesiones.data?.sesiones} cargando={sesiones.isPending} seleccionada={sesionId} alSeleccionar={setSesionId} />
      ) : (
        <EstadoVacio titulo="Elija sección y fecha" descripcion="Luego seleccione una sesión de clase para tomar su asistencia." />
      )}
      {sesionId && sesiones.data?.sesiones.some((s) => s.id === sesionId) ? (
        <RegistroAlumnos key={sesionId} modo="sesion" endpoint={`/api/admin/asistencia/sesiones/${sesionId}`} />
      ) : null}
    </div>
  );
}

const OPCIONES_MANUALES = ESTADOS_MANUALES.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO[e] }));

function PestanaDocentes() {
  const recargar = useRecargarListado();
  const [fecha, setFecha] = useState(hoyLima());
  const [editando, setEditando] = useState<FilaAsistenciaDocente | null>(null);
  const parametros = useMemo(() => ({ fecha }), [fecha]);
  return (
    <div className="grid gap-4">
      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="fecha-docentes">Fecha</Label>
        <Input id="fecha-docentes" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <TablaDatos<FilaAsistenciaDocente>
        endpoint={ENDPOINT_DOCENTES}
        parametros={parametros}
        claveFila={(f) => f.jornada_id}
        placeholderBusqueda="Buscar docente…"
        filtros={[{ nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ESTADOS_ASISTENCIA.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO[e] })) }]}
        vacio={<EstadoVacio titulo="Sin jornadas docentes" descripcion="No hay jornadas de docentes programadas en esa fecha." />}
        columnas={[
          { clave: 'docente', titulo: 'Docente', celda: (f) => <span className="font-medium">{f.docente}</span> },
          { clave: 'horario', titulo: 'Jornada', celda: (f) => `${formatoHora(f.hora_entrada)}–${formatoHora(f.hora_salida)}`, ocultarEnMovil: true },
          { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
          { clave: 'entrada', titulo: 'Entrada', celda: (f) => formatoHora(f.entrada), ocultarEnMovil: true },
          { clave: 'salida', titulo: 'Salida', celda: (f) => formatoHora(f.salida), ocultarEnMovil: true },
          { clave: 'motivo', titulo: 'Motivo', celda: (f) => <span className="line-clamp-2 text-xs text-muted-foreground">{f.motivo ?? '—'}</span>, ocultarEnMovil: true },
        ]}
        acciones={(f) =>
          f.estado === 'justificado' ? null : (
            <Button variant="ghost" size="icon-sm" aria-label={`Registrar asistencia de ${f.docente}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
          )
        }
      />
      <DialogoFormulario
        titulo={`Asistencia de ${editando?.docente ?? ''}`}
        descripcion="La base verifica que el estado sea coherente con las marcaciones y la política."
        esquema={esquemaRegistroDocente}
        valores={editando ? { jornadaId: editando.jornada_id, estado: editando.estado === 'pendiente' ? 'presente' : (editando.estado as 'presente'), motivo: '' } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.post(ENDPOINT_DOCENTES, d);
          await recargar(ENDPOINT_DOCENTES);
        }}
        mensajeExito="Asistencia registrada"
      >
        <CampoSelect nombre="estado" etiqueta="Estado" opciones={OPCIONES_MANUALES} />
        <CampoTexto nombre="motivo" etiqueta="Motivo" placeholder="Ej.: registro manual por falla del lector" />
      </DialogoFormulario>
    </div>
  );
}

export function ClienteAsistenciaDiaria() {
  return (
    <>
      <EncabezadoPagina
        titulo="Asistencia diaria"
        descripcion="Registre o corrija la asistencia de alumnos (por día o por sesión de clase) y de docentes. Todo cambio exige motivo y queda auditado."
      />
      <Tabs defaultValue="seccion">
        <TabsList className="flex-wrap">
          <TabsTrigger value="seccion">Alumnos por sección</TabsTrigger>
          <TabsTrigger value="sesion">Por sesión de clase</TabsTrigger>
          <TabsTrigger value="docentes">Docentes</TabsTrigger>
        </TabsList>
        <TabsContent value="seccion">
          <PestanaSeccion />
        </TabsContent>
        <TabsContent value="sesion">
          <PestanaSesion />
        </TabsContent>
        <TabsContent value="docentes">
          <PestanaDocentes />
        </TabsContent>
      </Tabs>
    </>
  );
}
