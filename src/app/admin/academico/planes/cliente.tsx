'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormContext, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { BookCopy, CalendarRange, Layers, ListChecks, Plus, Send, Trash2, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio, SelectSimple } from '@/components/academico/selectores';
import { CampoCasillas } from '@/components/academico/campo-casillas';
import { api, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import {
  esquemaAsignarSeccion,
  esquemaMapeo,
  esquemaPlan,
  esquemaVigencia,
  type AsignaturaDelPlan,
  type DetallePlan,
  type FilaPlan,
  type SeccionDelPlan,
} from '@/esquemas/academico/planes';
import { SIN_SELECCION } from '@/esquemas/academico/seleccion';

const ENDPOINT = '/api/admin/academico/planes';
const OPCIONES_ESTADO = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'publicado', etiqueta: 'Publicado' },
];

function CamposPlan() {
  const { control } = useFormContext();
  const gradoId = useWatch({ control, name: 'gradoId' }) as string | undefined;
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  const planes = useCatalogo('planes', { gradoId }, Boolean(gradoId));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="anioId" etiqueta="Año académico" opciones={anios.data ?? []} />
      <CampoSelect nombre="gradoId" etiqueta="Grado" opciones={grados.data ?? []} />
      <CampoTexto nombre="version" etiqueta="Versión" tipo="number" descripcion="Vacío: la siguiente disponible" />
      <CampoSelect
        nombre="basadoEn"
        etiqueta="Copiar contenido de"
        opciones={[{ valor: SIN_SELECCION, etiqueta: 'Plan vacío' }, ...(planes.data ?? []).map((p) => ({ valor: p.valor, etiqueta: p.etiqueta }))]}
        descripcion="Asignaturas, competencias y mapeo"
        deshabilitado={!gradoId}
      />
    </div>
  );
}

export function ClientePlanes() {
  const recargar = useRecargarListado();
  const [anioId, setAnioId] = useState<string | undefined>();
  const [planId, setPlanId] = useState<string | null>(null);
  const grados = useCatalogo('grados');
  const parametros = useMemo(() => ({ anioId }), [anioId]);

  return (
    <>
      <EncabezadoPagina
        titulo="Planes de estudio"
        descripcion="Planes versionados por año y grado. Un plan publicado no se modifica: cree una nueva versión. Solo los publicados se aplican a secciones."
        acciones={
          <DialogoFormulario
            titulo="Nuevo plan de estudios"
            esquema={esquemaPlan}
            valores={{ anioId: anioId ?? '', gradoId: '', basadoEn: SIN_SELECCION }}
            ancho="lg"
            mensajeExito="Plan creado en borrador"
            alEnviar={async (d) => {
              const r = await api.post<{ id: string }>(ENDPOINT, d);
              await recargar(ENDPOINT);
              setPlanId(r.id);
            }}
            disparador={
              <Button>
                <Plus aria-hidden /> Nuevo plan
              </Button>
            }
          >
            <CamposPlan />
          </DialogoFormulario>
        }
      />
      <div className="mb-4">
        <SelectorAnio valor={anioId} alCambiar={setAnioId} />
      </div>
      <TablaDatos<FilaPlan>
        endpoint={ENDPOINT}
        parametros={parametros}
        claveFila={(f) => f.id}
        buscador={false}
        filtros={[
          { nombre: 'gradoId', etiqueta: 'Grado', tipo: 'select', opciones: grados.data ?? [] },
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO },
        ]}
        alSeleccionarFila={(f) => setPlanId(f.id)}
        vacio={<EstadoVacio titulo="Sin planes" descripcion="Cree el plan de estudios de cada grado para el año." />}
        columnas={[
          {
            clave: 'grado',
            titulo: 'Plan',
            celda: (f) => (
              <div>
                <p className="font-medium">
                  {f.grado} · v{f.version}
                </p>
                <p className="text-xs text-muted-foreground">Año {f.anio}</p>
              </div>
            ),
          },
          {
            clave: 'estado',
            titulo: 'Estado',
            celda: (f) => (
              <div className="grid gap-0.5">
                <BadgeEstado estado={f.publicado_en ? 'publicado' : 'borrador'} />
                {f.publicado_en ? <span className="hidden text-xs text-muted-foreground md:inline">{formatoFechaHora(f.publicado_en)}</span> : null}
              </div>
            ),
          },
          { clave: 'asignaturas', titulo: 'Asignaturas', ocultarEnMovil: true, className: 'tabular-nums' },
          { clave: 'competencias', titulo: 'Competencias', ocultarEnMovil: true, className: 'tabular-nums' },
          { clave: 'secciones', titulo: 'Secciones', ocultarEnMovil: true, className: 'tabular-nums' },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Abrir plan ${f.grado} v${f.version}`} onClick={() => setPlanId(f.id)}>
            <Layers aria-hidden />
          </Button>
        )}
      />
      {planId ? <PanelPlan key={planId} id={planId} alAbrir={setPlanId} alCerrar={() => setPlanId(null)} /> : null}
    </>
  );
}

function PanelPlan(props: { id: string; alAbrir: (id: string) => void; alCerrar: () => void }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const clave = ['plan', props.id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetallePlan>(`${ENDPOINT}/${props.id}`) });
  const asignaturas = useCatalogo('asignaturas');
  const competencias = useCatalogo('competencias');
  const [nuevaAsignatura, setNuevaAsignatura] = useState<string>();
  const [nuevaCompetencia, setNuevaCompetencia] = useState<string>();
  const [mapeando, setMapeando] = useState<AsignaturaDelPlan | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [vigenciaDe, setVigenciaDe] = useState<SeccionDelPlan | null>(null);
  const p = consulta.data;
  const secciones = useCatalogo('secciones', { anioId: p?.anio_id, gradoId: p?.grado_id }, Boolean(p));

  const refrescar = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: clave }), recargar(ENDPOINT), qc.invalidateQueries({ queryKey: ['catalogo', 'planes'] })]);
  };
  const ejecutar = async (fn: () => Promise<unknown>, exito: string) => {
    try {
      await fn();
      toast.success(exito);
      await refrescar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  };

  if (consulta.isPending) return <Skeleton className="mt-6 h-64 w-full" />;
  if (!p) return <EstadoVacio titulo="No se pudo cargar el plan" descripcion={mensajeDeError(consulta.error)} />;

  const borrador = !p.publicado_en;
  const enPlanAsig = new Set(p.lista_asignaturas.map((a) => a.asignatura_id));
  const enPlanComp = new Set(p.lista_competencias.map((c) => c.competencia_id));
  const codigoCompetencia = new Map(p.lista_competencias.map((c) => [c.competencia_id, `${c.codigo}`]));
  const sinCompetencias = p.lista_asignaturas.filter((a) => a.competencias.length === 0);
  const mapeadas = new Set(p.lista_asignaturas.flatMap((a) => a.competencias));
  const sinCalificar = p.lista_competencias.filter((c) => !mapeadas.has(c.competencia_id));

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {p.grado} · versión {p.version} <BadgeEstado estado={borrador ? 'borrador' : 'publicado'} />
          </CardTitle>
          <CardDescription>
            Año {p.anio} ({formatoFecha(p.anio_inicio)} – {formatoFecha(p.anio_fin)})
            {p.publicado_en ? ` · publicado el ${formatoFechaHora(p.publicado_en)}` : ''}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {borrador ? (
            <>
              <Confirmar
                titulo={`¿Publicar el plan v${p.version}?`}
                descripcion="Una vez publicado su contenido no se podrá modificar; podrá aplicarlo a secciones."
                textoConfirmar="Publicar"
                mensajeExito="Plan publicado"
                alConfirmar={async () => {
                  await api.post(`${ENDPOINT}/${p.id}/publicar`);
                  await refrescar();
                }}
                disparador={
                  <Button size="sm">
                    <Send aria-hidden /> Publicar
                  </Button>
                }
              />
              <Confirmar
                titulo={`¿Eliminar el borrador v${p.version}?`}
                destructivo
                textoConfirmar="Eliminar"
                mensajeExito="Borrador eliminado"
                alConfirmar={async () => {
                  await api.delete(`${ENDPOINT}/${p.id}`);
                  await refrescar();
                  props.alCerrar();
                }}
                disparador={
                  <Button size="sm" variant="outline">
                    <Trash2 aria-hidden /> Eliminar
                  </Button>
                }
              />
            </>
          ) : (
            <Button size="sm" onClick={() => setAplicando(true)}>
              <CalendarRange aria-hidden /> Aplicar a sección
            </Button>
          )}
          <Confirmar
            titulo="¿Crear una nueva versión?"
            descripcion="Se creará un borrador del mismo año y grado con una copia de asignaturas, competencias y mapeo."
            textoConfirmar="Crear versión"
            mensajeExito="Nueva versión creada"
            alConfirmar={async () => {
              const r = await api.post<{ id: string }>(ENDPOINT, { anioId: p.anio_id, gradoId: p.grado_id, basadoEn: p.id });
              await refrescar();
              props.alAbrir(r.id);
            }}
            disparador={
              <Button size="sm" variant="outline">
                <BookCopy aria-hidden /> Nueva versión
              </Button>
            }
          />
          <Button size="icon-sm" variant="ghost" aria-label="Cerrar plan" onClick={props.alCerrar}>
            <X aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {sinCompetencias.length > 0 || sinCalificar.length > 0 ? (
          <div role="note" className="flex items-start gap-2 rounded-md bg-alerta px-3 py-2 text-sm text-alerta-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              {sinCompetencias.length > 0 ? <p>Asignaturas sin competencias asignadas: {sinCompetencias.map((a) => a.nombre).join(', ')}.</p> : null}
              {sinCalificar.length > 0 ? <p>Competencias que ninguna asignatura califica: {sinCalificar.map((c) => c.codigo).join(', ')}.</p> : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="plan-asignaturas" className="grid content-start gap-3">
            <h3 id="plan-asignaturas" className="font-semibold">
              Asignaturas ({p.lista_asignaturas.length})
            </h3>
            {borrador ? (
              <div className="flex gap-2">
                <SelectSimple
                  etiqueta="Asignatura a agregar"
                  placeholder="Agregar asignatura…"
                  opciones={(asignaturas.data ?? []).filter((a) => !enPlanAsig.has(a.valor))}
                  valor={nuevaAsignatura}
                  alCambiar={setNuevaAsignatura}
                  className="sm:w-full"
                />
                <Button
                  variant="outline"
                  disabled={!nuevaAsignatura}
                  onClick={() =>
                    ejecutar(async () => {
                      await api.post(`${ENDPOINT}/${p.id}/asignaturas`, { asignaturaId: nuevaAsignatura });
                      setNuevaAsignatura(undefined);
                    }, 'Asignatura agregada')
                  }
                >
                  <Plus aria-hidden /> Agregar
                </Button>
              </div>
            ) : null}
            {p.lista_asignaturas.length === 0 ? (
              <EstadoVacio titulo="Sin asignaturas" descripcion="Agregue las asignaturas y talleres del grado." />
            ) : (
              <ul className="grid gap-2">
                {p.lista_asignaturas.map((a) => (
                  <li key={a.asignatura_id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {a.nombre} {a.es_taller ? <Etiqueta tono="info">Taller</Etiqueta> : null}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{a.codigo}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.competencias.length ? (
                          a.competencias.map((c) => (
                            <Etiqueta key={c} className="font-mono">
                              {codigoCompetencia.get(c) ?? c}
                            </Etiqueta>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin competencias</span>
                        )}
                      </div>
                    </div>
                    {borrador ? (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Competencias que califica ${a.nombre}`} onClick={() => setMapeando(a)}>
                          <ListChecks aria-hidden />
                        </Button>
                        <Confirmar
                          titulo={`¿Quitar ${a.nombre} del plan?`}
                          descripcion="También se quitará su mapeo de competencias."
                          destructivo
                          textoConfirmar="Quitar"
                          mensajeExito="Asignatura quitada"
                          alConfirmar={async () => {
                            await api.delete(`${ENDPOINT}/${p.id}/asignaturas?asignaturaId=${a.asignatura_id}`);
                            await refrescar();
                          }}
                          disparador={
                            <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${a.nombre}`}>
                              <Trash2 aria-hidden />
                            </Button>
                          }
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="plan-competencias" className="grid content-start gap-3">
            <h3 id="plan-competencias" className="font-semibold">
              Competencias ({p.lista_competencias.length})
            </h3>
            {borrador ? (
              <div className="flex gap-2">
                <SelectSimple
                  etiqueta="Competencia a agregar"
                  placeholder="Agregar competencia…"
                  opciones={(competencias.data ?? []).filter((c) => !enPlanComp.has(c.valor))}
                  valor={nuevaCompetencia}
                  alCambiar={setNuevaCompetencia}
                  className="sm:w-full"
                />
                <Button
                  variant="outline"
                  disabled={!nuevaCompetencia}
                  onClick={() =>
                    ejecutar(async () => {
                      await api.post(`${ENDPOINT}/${p.id}/competencias`, { competenciaId: nuevaCompetencia });
                      setNuevaCompetencia(undefined);
                    }, 'Competencia agregada')
                  }
                >
                  <Plus aria-hidden /> Agregar
                </Button>
              </div>
            ) : null}
            {p.lista_competencias.length === 0 ? (
              <EstadoVacio titulo="Sin competencias" descripcion="Agregue las competencias que se evaluarán." />
            ) : (
              <ul className="grid gap-2">
                {p.lista_competencias.map((c) => (
                  <li key={c.competencia_id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-mono text-xs text-muted-foreground">
                        {c.codigo} v{c.version} {c.area ? `· ${c.area}` : ''} {c.reportable_siagie ? '· SIAGIE' : ''}
                      </p>
                      <p>{c.nombre}</p>
                    </div>
                    {borrador ? (
                      <Confirmar
                        titulo={`¿Quitar ${c.codigo} del plan?`}
                        descripcion="También se quitará de las asignaturas que la califican."
                        destructivo
                        textoConfirmar="Quitar"
                        mensajeExito="Competencia quitada"
                        alConfirmar={async () => {
                          await api.delete(`${ENDPOINT}/${p.id}/competencias?competenciaId=${c.competencia_id}`);
                          await refrescar();
                        }}
                        disparador={
                          <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${c.codigo}`}>
                            <Trash2 aria-hidden />
                          </Button>
                        }
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="plan-secciones" className="grid gap-3">
          <h3 id="plan-secciones" className="font-semibold">
            Secciones con este plan ({p.lista_secciones.length})
          </h3>
          {p.lista_secciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {borrador ? 'Publique el plan para aplicarlo a las secciones del grado.' : 'Aún no se aplica a ninguna sección.'}
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {p.lista_secciones.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="text-sm">
                    <p className="font-medium">{s.seccion}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatoFecha(s.inicio)} – {formatoFecha(s.fin)} · {s.cursos} curso(s)
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Cambiar vigencia en ${s.seccion}`} onClick={() => setVigenciaDe(s)}>
                    <CalendarRange aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>

      <DialogoFormulario
        titulo={`Competencias que califica ${mapeando?.nombre ?? ''}`}
        descripcion="Solo puede elegir competencias incluidas en el plan."
        esquema={esquemaMapeo}
        valores={mapeando ? { asignaturaId: mapeando.asignatura_id, competenciaIds: mapeando.competencias } : {}}
        abierto={mapeando !== null}
        alCambiarAbierto={(v) => !v && setMapeando(null)}
        ancho="lg"
        mensajeExito="Mapeo actualizado"
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${p.id}/mapeo`, d);
          await refrescar();
        }}
      >
        <CampoCasillas
          nombre="competenciaIds"
          etiqueta="Competencias del plan"
          opciones={p.lista_competencias.map((c) => ({ valor: c.competencia_id, etiqueta: `${c.codigo} · ${c.nombre}`, detalle: c.area ?? undefined }))}
          vacio={<p className="text-sm text-muted-foreground">Primero agregue competencias al plan.</p>}
        />
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Aplicar plan a una sección"
        descripcion="Se crearán los cursos de la sección (uno por asignatura). La vigencia debe estar dentro del año y no superponerse con otro plan de la sección."
        esquema={esquemaAsignarSeccion}
        valores={{ seccionId: '', inicio: p.anio_inicio, fin: p.anio_fin }}
        abierto={aplicando}
        alCambiarAbierto={setAplicando}
        textoEnviar="Aplicar"
        mensajeExito="Plan aplicado"
        alEnviar={async (d) => {
          const r = await api.post<{ cursos: number }>(`${ENDPOINT}/${p.id}/secciones`, d);
          await refrescar();
          toast.info(`Se crearon ${r.cursos} curso(s) en la sección.`);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect
            nombre="seccionId"
            etiqueta="Sección"
            opciones={secciones.data ?? []}
            placeholder={secciones.data?.length === 0 ? 'No hay secciones activas del grado' : 'Seleccione'}
            className="sm:col-span-2"
          />
          <CampoTexto nombre="inicio" etiqueta="Vigente desde" tipo="date" />
          <CampoTexto nombre="fin" etiqueta="Vigente hasta" tipo="date" />
        </div>
      </DialogoFormulario>

      <DialogoFormulario
        titulo={`Vigencia del plan en ${vigenciaDe?.seccion ?? ''}`}
        descripcion="Para cambiar de plan a mitad de año, acorte esta vigencia y aplique la nueva versión desde el día siguiente."
        esquema={esquemaVigencia}
        valores={vigenciaDe ? { inicio: vigenciaDe.inicio ?? p.anio_inicio, fin: vigenciaDe.fin ?? p.anio_fin } : {}}
        abierto={vigenciaDe !== null}
        alCambiarAbierto={(v) => !v && setVigenciaDe(null)}
        mensajeExito="Vigencia actualizada"
        alEnviar={async (d) => {
          await api.put(`/api/admin/academico/seccion-planes/${vigenciaDe?.id}`, d);
          await refrescar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="inicio" etiqueta="Desde" tipo="date" />
          <CampoTexto nombre="fin" etiqueta="Hasta" tipo="date" />
        </div>
      </DialogoFormulario>
    </Card>
  );
}
