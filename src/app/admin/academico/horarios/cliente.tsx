'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormContext, useWatch } from 'react-hook-form';
import { CalendarClock, CalendarPlus, Check, Pencil, Plus, RotateCcw, Trash2, Wand2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio, Indicador } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { GrillaHorario } from '@/components/academico/grilla-horario';
import { SelectorAnio, SelectorSeccion } from '@/components/academico/selectores';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoHora, NOMBRE_DIA_ISO, sumarDias } from '@/lib/formato';
import {
  DIAS_SEMANA,
  ESTADOS_SESION,
  esquemaActualizarBloque,
  esquemaBloque,
  esquemaGenerarSesiones,
  esquemaSesion,
  type BloqueHorario,
  type FilaSesion,
  type HorarioSemanal,
  type ResultadoGeneracion,
} from '@/esquemas/academico/horarios';
import type { FilaAsignacion, FilaCurso } from '@/esquemas/academico/asignaciones';
import type { RespuestaListado } from '@/esquemas/comunes';
import { SIN_SELECCION } from '@/esquemas/academico/seleccion';

const BASE = '/api/admin/academico';
const ENDPOINT_SESIONES = `${BASE}/sesiones`;
const OPCIONES_DIA = DIAS_SEMANA.map((d) => ({ valor: d.valor, etiqueta: d.etiqueta }));
const OPCIONES_ESTADO = ESTADOS_SESION.map((e) => ({ valor: e, etiqueta: e.charAt(0).toUpperCase() + e.slice(1) }));

function useDatosSeccion(seccionId: string | undefined) {
  const cursos = useQuery({
    queryKey: ['horario-cursos', seccionId],
    queryFn: () => api.get<RespuestaListado<FilaCurso>>(conConsulta(`${BASE}/cursos`, { seccionId, porPagina: 200 })),
    enabled: Boolean(seccionId),
  });
  const asignaciones = useQuery({
    queryKey: ['horario-asignaciones', seccionId],
    queryFn: () => api.get<RespuestaListado<FilaAsignacion>>(conConsulta(`${BASE}/asignaciones`, { seccionId, porPagina: 200 })),
    enabled: Boolean(seccionId),
  });
  return { cursos: cursos.data?.filas ?? [], asignaciones: asignaciones.data?.filas ?? [] };
}

const etiquetaAsignacion = (a: FilaAsignacion) => `${a.docente} · ${a.funcion} (${formatoFecha(a.inicio)} – ${formatoFecha(a.fin)})`;

function CamposHoras() {
  const aulas = useCatalogo('aulas');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="diaIso" etiqueta="Día" opciones={OPCIONES_DIA} />
      <CampoSelect nombre="aulaId" etiqueta="Aula" opciones={[{ valor: SIN_SELECCION, etiqueta: 'Sin aula' }, ...(aulas.data ?? [])]} />
      <CampoTexto nombre="horaInicio" etiqueta="Hora de inicio" tipo="time" />
      <CampoTexto nombre="horaFin" etiqueta="Hora de fin" tipo="time" />
      <CampoTexto nombre="inicio" etiqueta="Vigente desde" tipo="date" />
      <CampoTexto nombre="fin" etiqueta="Vigente hasta" tipo="date" />
    </div>
  );
}

/** Curso → asignación del curso; al elegir la asignación propone su vigencia. */
function CamposNuevoBloque({ cursos, asignaciones }: { cursos: FilaCurso[]; asignaciones: FilaAsignacion[] }) {
  const { control, setValue } = useFormContext();
  const cursoId = useWatch({ control, name: 'cursoId' }) as string | undefined;
  const asignacionId = useWatch({ control, name: 'asignacionId' }) as string | undefined;
  const delCurso = asignaciones.filter((a) => a.curso_id === cursoId);
  useEffect(() => {
    const a = asignaciones.find((x) => x.id === asignacionId);
    if (a?.inicio && a.fin) {
      setValue('inicio', a.inicio);
      setValue('fin', a.fin);
    }
  }, [asignacionId, asignaciones, setValue]);
  useEffect(() => {
    if (asignacionId && !asignaciones.some((a) => a.id === asignacionId && a.curso_id === cursoId)) setValue('asignacionId', '');
  }, [cursoId, asignacionId, asignaciones, setValue]);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelect nombre="cursoId" etiqueta="Curso" opciones={cursos.filter((c) => c.activo).map((c) => ({ valor: c.id, etiqueta: c.asignatura }))} />
        <CampoSelect
          nombre="asignacionId"
          etiqueta="Docente (asignación)"
          opciones={delCurso.map((a) => ({ valor: a.id, etiqueta: etiquetaAsignacion(a) }))}
          placeholder={!cursoId ? 'Elija el curso' : delCurso.length === 0 ? 'El curso no tiene docentes asignados' : 'Seleccione'}
          deshabilitado={!cursoId}
        />
      </div>
      <CamposHoras />
    </>
  );
}

export function ClienteHorarios() {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const [anioId, setAnioId] = useState<string | undefined>();
  const [seccionId, setSeccionId] = useState<string | undefined>();
  const [fecha, setFecha] = useState('');
  const [bloque, setBloque] = useState<BloqueHorario | 'nuevo' | null>(null);
  const [generando, setGenerando] = useState(false);
  const [nuevaSesion, setNuevaSesion] = useState(false);
  const [resultado, setResultado] = useState<ResultadoGeneracion | null>(null);
  const { cursos, asignaciones } = useDatosSeccion(seccionId);
  const parametrosSesiones = useMemo(() => ({ seccionId }), [seccionId]);

  const horario = useQuery({
    queryKey: ['horario-seccion', seccionId, fecha],
    queryFn: () => api.get<HorarioSemanal & { seccion: { etiqueta: string; turno: string } | null }>(conConsulta(`${BASE}/horarios`, { seccionId, fecha: fecha || undefined })),
    enabled: Boolean(seccionId),
  });
  const fechaRef = horario.data?.fecha ?? fecha;
  const refrescarHorario = () => qc.invalidateQueries({ queryKey: ['horario-seccion', seccionId] });
  const refrescarSesiones = () => recargar(ENDPOINT_SESIONES);

  return (
    <>
      <EncabezadoPagina
        titulo="Horarios y sesiones"
        descripcion="Bloques semanales por sección y sesiones fechadas. Los cruces de sección, docente o aula los rechaza la base de datos."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SelectorAnio
          valor={anioId}
          alCambiar={(v) => {
            setAnioId(v);
            setSeccionId(undefined);
          }}
        />
        <SelectorSeccion anioId={anioId} valor={seccionId} alCambiar={setSeccionId} />
        <div className="flex items-center gap-2">
          <Label htmlFor="fecha-horario" className="shrink-0 text-sm text-muted-foreground">
            Vigente al
          </Label>
          <Input id="fecha-horario" type="date" value={fecha || fechaRef || ''} onChange={(e) => setFecha(e.target.value)} className="w-full sm:w-44" />
        </div>
      </div>

      {!seccionId ? (
        <EstadoVacio titulo="Elija una sección" descripcion="Seleccione el año y la sección para ver y editar su horario." />
      ) : (
        <Tabs defaultValue="horario">
          <div className="flex max-w-full flex-col gap-2 overflow-x-auto sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="horario">Horario semanal</TabsTrigger>
              <TabsTrigger value="sesiones">Sesiones de clase</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="horario" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {horario.data?.seccion ? `${horario.data.seccion.etiqueta} · turno ${horario.data.seccion.turno}` : ''}
                {fechaRef ? ` · bloques vigentes al ${formatoFecha(fechaRef)}` : ''}
              </p>
              <Button onClick={() => setBloque('nuevo')} disabled={cursos.length === 0}>
                <Plus aria-hidden /> Nuevo bloque
              </Button>
            </div>
            {cursos.length === 0 && !horario.isPending ? (
              <p className="text-sm text-muted-foreground">La sección no tiene cursos: aplíquele un plan de estudios publicado.</p>
            ) : null}
            {horario.isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : horario.isError ? (
              <EstadoVacio titulo="No se pudo cargar el horario" descripcion={mensajeDeError(horario.error)} />
            ) : (
              <GrillaHorario
                bloques={horario.data?.bloques ?? []}
                acciones={(b) => (
                  <>
                    <Button variant="ghost" size="icon-xs" aria-label={`Editar ${b.asignatura} ${NOMBRE_DIA_ISO[b.dia_iso]} ${formatoHora(b.hora_inicio)}`} onClick={() => setBloque(b)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Confirmar
                      titulo={`¿Eliminar el bloque de ${b.asignatura}?`}
                      descripcion={`${NOMBRE_DIA_ISO[b.dia_iso]} ${formatoHora(b.hora_inicio)}–${formatoHora(b.hora_fin)}. No es posible si ya generó sesiones; en ese caso acorte su vigencia.`}
                      destructivo
                      textoConfirmar="Eliminar"
                      mensajeExito="Bloque eliminado"
                      alConfirmar={async () => {
                        await api.delete(`${BASE}/horarios/${b.id}`);
                        await refrescarHorario();
                      }}
                      disparador={
                        <Button variant="ghost" size="icon-xs" aria-label={`Eliminar ${b.asignatura} ${NOMBRE_DIA_ISO[b.dia_iso]} ${formatoHora(b.hora_inicio)}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      }
                    />
                  </>
                )}
                vacio={<EstadoVacio titulo="Sin bloques" descripcion="Agregue los bloques semanales de cada curso." />}
              />
            )}
          </TabsContent>
          <TabsContent value="sesiones" className="grid gap-3">
            <TablaDatos<FilaSesion>
              endpoint={ENDPOINT_SESIONES}
              parametros={parametrosSesiones}
              claveFila={(f) => f.id}
              placeholderBusqueda="Buscar asignatura o docente…"
              porPagina={25}
              filtros={[
                { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO },
                { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
                { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
              ]}
              barra={
                <>
                  <Button size="sm" onClick={() => setGenerando(true)}>
                    <Wand2 aria-hidden /> Generar desde horario
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNuevaSesion(true)} disabled={asignaciones.length === 0}>
                    <CalendarPlus aria-hidden /> Sesión suelta
                  </Button>
                </>
              }
              vacio={<EstadoVacio titulo="Sin sesiones" descripcion="Genere las sesiones del período a partir del horario semanal." />}
              columnas={[
                {
                  clave: 'fecha',
                  titulo: 'Fecha',
                  celda: (f) => (
                    <div className="tabular-nums">
                      <p className="font-medium">{formatoFecha(f.fecha)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatoHora(f.hora_inicio)}–{formatoHora(f.hora_fin)}
                      </p>
                    </div>
                  ),
                },
                { clave: 'asignatura', titulo: 'Curso', celda: (f) => <span className="font-medium">{f.asignatura}</span> },
                { clave: 'docente', titulo: 'Docente', ocultarEnMovil: true },
                { clave: 'aula', titulo: 'Aula', ocultarEnMovil: true, celda: (f) => f.aula ?? '—' },
                { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
              ]}
              acciones={(f) => <AccionesSesion sesion={f} alCambiar={refrescarSesiones} />}
            />
          </TabsContent>
        </Tabs>
      )}

      <DialogoFormulario
        titulo="Nuevo bloque de horario"
        esquema={esquemaBloque}
        valores={{ cursoId: '', asignacionId: '', aulaId: SIN_SELECCION, diaIso: 1, horaInicio: '08:00', horaFin: '08:45', inicio: '', fin: '' }}
        abierto={bloque === 'nuevo'}
        alCambiarAbierto={(v) => !v && setBloque(null)}
        ancho="lg"
        mensajeExito="Bloque agregado"
        alEnviar={async (d) => {
          await api.post(`${BASE}/horarios`, d);
          await refrescarHorario();
        }}
      >
        <CamposNuevoBloque cursos={cursos} asignaciones={asignaciones} />
      </DialogoFormulario>
      <DialogoFormulario
        titulo={bloque && bloque !== 'nuevo' ? `Editar bloque · ${bloque.asignatura}` : 'Editar bloque'}
        descripcion={bloque && bloque !== 'nuevo' ? `Docente: ${bloque.docente}` : undefined}
        esquema={esquemaActualizarBloque}
        valores={
          bloque && bloque !== 'nuevo'
            ? {
                aulaId: bloque.aula_id ?? SIN_SELECCION,
                diaIso: bloque.dia_iso,
                horaInicio: bloque.hora_inicio.slice(0, 5),
                horaFin: bloque.hora_fin.slice(0, 5),
                inicio: bloque.inicio ?? '',
                fin: bloque.fin ?? '',
              }
            : {}
        }
        abierto={bloque !== null && bloque !== 'nuevo'}
        alCambiarAbierto={(v) => !v && setBloque(null)}
        ancho="lg"
        alEnviar={async (d) => {
          if (bloque && bloque !== 'nuevo') await api.put(`${BASE}/horarios/${bloque.id}`, d);
          await refrescarHorario();
        }}
      >
        <CamposHoras />
      </DialogoFormulario>
      <DialogoFormulario
        titulo="Generar sesiones desde el horario"
        descripcion="Crea sesiones programadas para cada bloque en el rango. Omite días no lectivos del calendario y sesiones ya generadas."
        esquema={esquemaGenerarSesiones}
        valores={{ seccionId: seccionId ?? '', cursoId: SIN_SELECCION, desde: fechaRef || '', hasta: fechaRef ? sumarDias(fechaRef, 13) : '' }}
        abierto={generando}
        alCambiarAbierto={setGenerando}
        textoEnviar="Generar"
        mensajeExito="Generación terminada"
        alEnviar={async (d) => {
          const r = await api.post<ResultadoGeneracion>(`${ENDPOINT_SESIONES}/generar`, d);
          await refrescarSesiones();
          setResultado(r);
        }}
      >
        <CampoSelect
          nombre="cursoId"
          etiqueta="Curso"
          opciones={[{ valor: SIN_SELECCION, etiqueta: 'Todos los cursos' }, ...cursos.map((c) => ({ valor: c.id, etiqueta: c.asignatura }))]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="desde" etiqueta="Desde" tipo="date" />
          <CampoTexto nombre="hasta" etiqueta="Hasta" tipo="date" descripcion="Máximo 186 días" />
        </div>
      </DialogoFormulario>
      <DialogoFormulario
        titulo="Nueva sesión"
        descripcion="Sesión fuera del horario regular (recuperación, actividad). Debe estar dentro de la vigencia de la asignación."
        esquema={esquemaSesion}
        valores={{ asignacionId: '', aulaId: SIN_SELECCION, fecha: fechaRef || '', horaInicio: '08:00', horaFin: '08:45' }}
        abierto={nuevaSesion}
        alCambiarAbierto={setNuevaSesion}
        mensajeExito="Sesión registrada"
        alEnviar={async (d) => {
          await api.post(ENDPOINT_SESIONES, d);
          await refrescarSesiones();
        }}
      >
        <CampoSelect nombre="asignacionId" etiqueta="Curso y docente" opciones={asignaciones.map((a) => ({ valor: a.id, etiqueta: `${a.asignatura} · ${etiquetaAsignacion(a)}` }))} />
        <CamposSesion />
      </DialogoFormulario>
      <DialogoResultado resultado={resultado} alCerrar={() => setResultado(null)} />
    </>
  );
}

function CamposSesion() {
  const aulas = useCatalogo('aulas');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto nombre="fecha" etiqueta="Fecha" tipo="date" />
      <CampoSelect nombre="aulaId" etiqueta="Aula" opciones={[{ valor: SIN_SELECCION, etiqueta: 'Sin aula' }, ...(aulas.data ?? [])]} />
      <CampoTexto nombre="horaInicio" etiqueta="Hora de inicio" tipo="time" />
      <CampoTexto nombre="horaFin" etiqueta="Hora de fin" tipo="time" />
    </div>
  );
}

function AccionesSesion({ sesion, alCambiar }: { sesion: FilaSesion; alCambiar: () => Promise<unknown> }) {
  const cambiar = (estado: string) => async () => {
    await api.patch(`${ENDPOINT_SESIONES}/${sesion.id}`, { estado });
    await alCambiar();
  };
  const nombre = `${sesion.asignatura} del ${formatoFecha(sesion.fecha)} ${formatoHora(sesion.hora_inicio)}`;
  if (sesion.estado === 'programada') {
    return (
      <>
        <Confirmar
          titulo="¿Marcar la sesión como realizada?"
          descripcion={nombre}
          textoConfirmar="Marcar realizada"
          mensajeExito="Sesión realizada"
          alConfirmar={cambiar('realizada')}
          disparador={
            <Button variant="ghost" size="icon-sm" aria-label={`Marcar realizada ${nombre}`}>
              <Check aria-hidden />
            </Button>
          }
        />
        <Confirmar
          titulo="¿Cancelar la sesión?"
          descripcion={`${nombre}. Libera la franja horaria.`}
          destructivo
          textoConfirmar="Cancelar sesión"
          mensajeExito="Sesión cancelada"
          alConfirmar={cambiar('cancelada')}
          disparador={
            <Button variant="ghost" size="icon-sm" aria-label={`Cancelar ${nombre}`}>
              <XCircle aria-hidden />
            </Button>
          }
        />
      </>
    );
  }
  if (sesion.estado === 'cancelada') {
    return (
      <Confirmar
        titulo="¿Reprogramar la sesión?"
        descripcion={`${nombre}. Volverá a estado programada si la franja sigue libre.`}
        textoConfirmar="Reprogramar"
        mensajeExito="Sesión reprogramada"
        alConfirmar={cambiar('programada')}
        disparador={
          <Button variant="ghost" size="icon-sm" aria-label={`Reprogramar ${nombre}`}>
            <RotateCcw aria-hidden />
          </Button>
        }
      />
    );
  }
  return <CalendarClock className="mx-2 size-4 text-muted-foreground" aria-label="Sesión realizada" />;
}

function DialogoResultado({ resultado, alCerrar }: { resultado: ResultadoGeneracion | null; alCerrar: () => void }) {
  return (
    <Dialog open={resultado !== null} onOpenChange={(v) => !v && alCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resultado de la generación</DialogTitle>
          <DialogDescription>Las sesiones rechazadas por la base (choques o vigencias) se listan con su motivo.</DialogDescription>
        </DialogHeader>
        {resultado ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Indicador titulo="Creadas" valor={resultado.creadas} />
              <Indicador titulo="Ya existían" valor={resultado.existentes} />
              <Indicador titulo="Días no lectivos" valor={resultado.diasSinClase} />
              <Indicador titulo="Omitidas" valor={resultado.omitidas.length} />
            </div>
            {resultado.omitidas.length > 0 ? (
              <ul className="grid gap-1 text-sm">
                {resultado.omitidas.map((o, i) => (
                  <li key={`${o.fecha}-${i}`} className="rounded-md border px-3 py-2">
                    <span className="font-medium">
                      {formatoFecha(o.fecha)} · {o.asignatura}
                    </span>
                    <span className="block text-xs text-muted-foreground">{o.motivo}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={alCerrar}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
