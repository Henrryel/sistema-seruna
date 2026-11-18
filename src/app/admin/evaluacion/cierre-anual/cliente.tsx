'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCheck, Eye, FilePlus2, GitBranchPlus, Loader2, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, BadgeNivelLogro, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { Confirmar } from '@/components/formularios/confirmar';
import { BadgeSituacion } from '@/components/evaluacion/resumen-criterios';
import { SelectorAnio, SelectorCampo, SelectorSeccion, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { ETIQUETA_SITUACION, SITUACIONES, type Situacion } from '@/esquemas/evaluacion/criterios';
import { ETIQUETA_ETAPA, type DetalleCierreAnual, type FilaCierreAnual, type ResultadoGeneracion } from '@/esquemas/evaluacion/cierre-anual';
import type { ResultadoLote } from '@/esquemas/evaluacion/cierres';
import type { RespuestaListado } from '@/esquemas/comunes';

const ENDPOINT = '/api/admin/evaluacion/cierre-anual';
const OPCIONES_SITUACION = SITUACIONES.map((s) => ({ valor: s, etiqueta: ETIQUETA_SITUACION[s] }));

export function ClienteCierreAnual() {
  const recargar = useRecargarListado();
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [seccionId, setSeccionId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const parametros = useMemo(() => ({ anioId, seccionId }), [anioId, seccionId]);

  return (
    <>
      <EncabezadoPagina
        titulo="Cierre anual y situación final"
        descripcion="Borradores por matrícula con los últimos logros publicados; la situación se sugiere con la regla aprobada y la base verifica la coherencia al aprobar."
        acciones={
          anioId ? (
            <>
              <DialogoGenerar anioId={anioId} seccionId={seccionId} alTerminar={() => recargar(ENDPOINT)} />
              <DialogoAprobarLote anioId={anioId} seccionId={seccionId} alTerminar={() => recargar(ENDPOINT)} />
            </>
          ) : null
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <SelectorAnio
          anios={anios}
          anioId={anioId}
          alCambiar={(v) => {
            setAnioId(v);
            setSeccionId(null);
          }}
        />
        <SelectorSeccion anioId={anioId} valor={seccionId} alCambiar={setSeccionId} opcionVacia="Todas" />
      </div>
      {anioId ? (
        <TablaDatos<FilaCierreAnual>
          endpoint={ENDPOINT}
          parametros={parametros}
          claveFila={(f) => f.id}
          placeholderBusqueda="Buscar estudiante o código…"
          filtros={[
            { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: [{ valor: 'borrador', etiqueta: 'Borrador' }, { valor: 'aprobado', etiqueta: 'Aprobado' }] },
            { nombre: 'situacion', etiqueta: 'Situación', tipo: 'select', opciones: OPCIONES_SITUACION },
          ]}
          alSeleccionarFila={(f) => setDetalle(f.id)}
          columnas={[
            {
              clave: 'alumno',
              titulo: 'Estudiante',
              celda: (f) => (
                <div>
                  <p className="font-medium">{f.alumno}</p>
                  <p className="text-xs text-muted-foreground">{f.codigo}</p>
                </div>
              ),
            },
            { clave: 'seccion', titulo: 'Sección', celda: (f) => `${f.grado}.º ${f.seccion}`, ocultarEnMovil: true },
            { clave: 'version', titulo: 'Versión', celda: (f) => `v${f.version} · ${ETIQUETA_ETAPA[f.etapa]}`, ocultarEnMovil: true },
            { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
            { clave: 'situacion', titulo: 'Situación', celda: (f) => <BadgeSituacion situacion={f.situacion} /> },
            { clave: 'pendientes', titulo: 'Pendientes', celda: (f) => (f.pendientes ? <Etiqueta tono="alerta">{f.pendientes}</Etiqueta> : '—'), ocultarEnMovil: true },
          ]}
          acciones={(f) => (
            <Button variant="ghost" size="icon-sm" aria-label={`Ver cierre de ${f.alumno}`} onClick={() => setDetalle(f.id)}>
              <Eye aria-hidden />
            </Button>
          )}
          vacio={<EstadoVacio titulo="Sin cierres anuales" descripcion="Publique los cuatro bimestres, apruebe la regla del grado y genere los borradores." />}
        />
      ) : null}
      <DetalleSheet id={detalle} alCambiarId={setDetalle} alCambiar={() => recargar(ENDPOINT)} />
    </>
  );
}

function DialogoGenerar({ anioId, seccionId, alTerminar }: { anioId: string; seccionId: string | null; alTerminar: () => unknown }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoGeneracion | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setResultado(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <FilePlus2 aria-hidden /> Generar borradores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar borradores de cierre anual</DialogTitle>
          <DialogDescription>
            Versión 1 (ordinario) con fecha de corte al fin del 4.º bimestre para las matrículas {seccionId ? 'de la sección elegida' : 'de todas las secciones del año'} que aún no tienen cierre.
          </DialogDescription>
        </DialogHeader>
        {resultado ? (
          <div className="grid gap-2 text-sm" aria-live="polite">
            <p>
              <strong>{resultado.creados}</strong> borrador(es) creado(s).
            </p>
            {resultado.omitidos.length ? (
              <ul className="grid max-h-60 gap-1 overflow-y-auto">
                {resultado.omitidos.map((o) => (
                  <li key={o.matriculaId}>
                    <Etiqueta tono="alerta">Omitido</Etiqueta> {o.alumno}: {o.motivo}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            {resultado ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!resultado ? (
            <Button
              disabled={enviando}
              onClick={async () => {
                setEnviando(true);
                try {
                  setResultado(await api.post<ResultadoGeneracion>(ENDPOINT, { anioId, seccionId: seccionId ?? undefined }));
                  await alTerminar();
                } catch (e) {
                  toast.error(mensajeDeError(e));
                } finally {
                  setEnviando(false);
                }
              }}
            >
              {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Generar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoAprobarLote({ anioId, seccionId, alTerminar }: { anioId: string; seccionId: string | null; alTerminar: () => unknown }) {
  const [abierto, setAbierto] = useState(false);
  const [sustento, setSustento] = useState('');
  const [resultados, setResultados] = useState<(ResultadoLote & { alumno: string })[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setResultados(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <CheckCheck aria-hidden /> Aprobar sugeridos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprobar borradores con la situación sugerida</DialogTitle>
          <DialogDescription>Aplica a los borradores {seccionId ? 'de la sección elegida' : 'del año'}. Cada uno se valida por separado en la base.</DialogDescription>
        </DialogHeader>
        {resultados ? (
          <ul className="grid max-h-72 gap-1 overflow-y-auto text-sm" aria-live="polite">
            {resultados.length === 0 ? <li>No hay borradores pendientes.</li> : null}
            {resultados.map((r) => (
              <li key={r.id}>
                <Etiqueta tono={r.ok ? 'exito' : 'peligro'}>{r.ok ? 'Aprobado' : 'Error'}</Etiqueta> {r.alumno}: {r.mensaje}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="sustento-lote">Sustento (acta, sesión de evaluación…)</Label>
            <Textarea id="sustento-lote" rows={3} value={sustento} onChange={(e) => setSustento(e.target.value)} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            {resultados ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!resultados ? (
            <Button
              disabled={enviando || sustento.trim().length < 3}
              onClick={async () => {
                setEnviando(true);
                try {
                  const lista = await api.get<RespuestaListado<FilaCierreAnual>>(conConsulta(ENDPOINT, { anioId, seccionId, estado: 'borrador', porPagina: 200 }));
                  if (!lista.filas.length) return setResultados([]);
                  const nombres = new Map(lista.filas.map((f) => [f.id, f.alumno]));
                  const r = await api.post<{ resultados: ResultadoLote[] }>(`${ENDPOINT}/aprobar-lote`, { ids: lista.filas.map((f) => f.id), sustento: sustento.trim() });
                  setResultados(r.resultados.map((x) => ({ ...x, alumno: nombres.get(x.id) ?? x.id })));
                  await alTerminar();
                } catch (e) {
                  toast.error(mensajeDeError(e));
                } finally {
                  setEnviando(false);
                }
              }}
            >
              {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Aprobar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FUENTE: Record<string, string> = { calificacion: 'Bimestre', recuperacion: 'Recuperación', anterior: 'Versión anterior' };

function DetalleSheet({ id, alCambiarId, alCambiar }: { id: string | null; alCambiarId: (id: string | null) => void; alCambiar: () => unknown }) {
  const qc = useQueryClient();
  const clave = ['cierre-anual', id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetalleCierreAnual>(`${ENDPOINT}/${id}`), enabled: Boolean(id) });
  const d = consulta.data;
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [pendientesEditados, setPendientesEditados] = useState(false);
  const [situacion, setSituacion] = useState<Situacion | null>(null);
  const [sustento, setSustento] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!d) return;
    setPendientes(new Set(d.resultados_detalle.filter((r) => r.requiere_recuperacion).map((r) => r.competencia_id)));
    setPendientesEditados(false);
    setSituacion(('situacion' in d.sugerencia ? d.sugerencia.situacion : null) ?? d.situacion);
    setSustento(d.sustento ?? '');
  }, [d]);

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await alCambiar();
  };
  const ejecutar = async (fn: () => Promise<unknown>, exito: string) => {
    setEnviando(true);
    try {
      await fn();
      toast.success(exito);
      await refrescar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };
  const borrador = d?.estado === 'borrador';
  const esUltimo = d ? d.trayectoria.at(-1)?.id === d.id : false;

  return (
    <Sheet open={Boolean(id)} onOpenChange={(v) => !v && alCambiarId(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{d ? d.alumno : 'Cierre anual'}</SheetTitle>
          <SheetDescription>
            {d ? `${d.codigo} · ${d.grado}.º ${d.seccion} ${d.nivel} · v${d.version} ${ETIQUETA_ETAPA[d.etapa]} · corte ${formatoFecha(d.fecha_corte)}` : ''}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          {consulta.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : consulta.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {mensajeDeError(consulta.error)}
            </p>
          ) : d ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <BadgeEstado estado={d.estado} />
                <BadgeSituacion situacion={d.situacion} />
                <span className="text-xs text-muted-foreground">
                  Regla v{d.regla.version}: {d.regla.referencia}
                </span>
              </div>
              {d.motivo_revision ? <p className="text-sm">Motivo de la versión: {d.motivo_revision}</p> : null}

              <section aria-labelledby="sugerencia" className="rounded-lg border p-3">
                <h3 id="sugerencia" className="mb-1 text-sm font-semibold">
                  Situación sugerida por la regla
                </h3>
                {'error' in d.sugerencia && d.sugerencia.error ? (
                  <p className="text-sm text-destructive">{d.sugerencia.error}</p>
                ) : 'situacion' in d.sugerencia ? (
                  <>
                    <BadgeSituacion situacion={d.sugerencia.situacion} />
                    <span className="ml-2 text-sm">{d.sugerencia.regla ?? 'Ninguna regla se cumple: situación por defecto'}</span>
                    <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                      {d.sugerencia.detalle.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>

              <section aria-labelledby="resultados" className="grid gap-2">
                <h3 id="resultados" className="text-sm font-semibold">
                  Resultados por competencia ({d.resultados}/{d.resultados + d.faltantes.length})
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competencia</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead className="hidden sm:table-cell">Fuente</TableHead>
                        <TableHead>Pendiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.resultados_detalle.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="text-sm">{r.competencia}</p>
                            <p className="text-xs text-muted-foreground">{r.area ?? '—'}</p>
                          </TableCell>
                          <TableCell>
                            <BadgeNivelLogro nivel={r.nivel_logro} />
                          </TableCell>
                          <TableCell className="hidden text-xs sm:table-cell">
                            {FUENTE[r.fuente]}
                            {r.bimestre ? ` (${r.bimestre}.º)` : ''}
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              aria-label={`Pendiente de recuperación: ${r.competencia}`}
                              checked={pendientes.has(r.competencia_id)}
                              disabled={!borrador || d.etapa === 'recuperacion'}
                              onCheckedChange={(v) => {
                                setPendientesEditados(true);
                                setPendientes((s) => {
                                  const n = new Set(s);
                                  if (v === true) n.add(r.competencia_id);
                                  else n.delete(r.competencia_id);
                                  return n;
                                });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {d.faltantes.length ? (
                  <p role="alert" className="rounded-md bg-alerta px-3 py-2 text-sm text-alerta-foreground">
                    Sin logro publicado: {d.faltantes.map((f) => f.competencia).join('; ')}. La base no aprobará el cierre sin resultados de todo el plan.
                  </p>
                ) : null}
              </section>

              {borrador ? (
                <section aria-labelledby="aprobar" className="grid gap-3 rounded-lg border p-3">
                  <h3 id="aprobar" className="text-sm font-semibold">
                    Aprobar
                  </h3>
                  <SelectorCampo etiqueta="Situación final" valor={situacion} alCambiar={(v) => setSituacion(v as Situacion | null)} opciones={OPCIONES_SITUACION} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="sustento">Sustento</Label>
                    <Textarea id="sustento" rows={3} value={sustento} onChange={(e) => setSustento(e.target.value)} placeholder="Acta de evaluación, acuerdos de la comisión…" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={enviando || !situacion || sustento.trim().length < 3}
                      onClick={() =>
                        ejecutar(
                          () =>
                            api.post(`${ENDPOINT}/${d.id}/aprobar`, {
                              situacion,
                              sustento: sustento.trim(),
                              pendientes: pendientesEditados ? [...pendientes] : undefined,
                            }),
                          'Cierre anual aprobado',
                        )
                      }
                    >
                      {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Aprobar
                    </Button>
                    <Button variant="outline" disabled={enviando} onClick={() => ejecutar(() => api.post(`${ENDPOINT}/${d.id}/actualizar`), 'Borrador actualizado')}>
                      <RefreshCw aria-hidden /> Actualizar desde logros
                    </Button>
                    <Confirmar
                      titulo="¿Descartar el borrador?"
                      descripcion="Se eliminan el borrador y sus resultados. Podrá generarlo de nuevo."
                      destructivo
                      textoConfirmar="Descartar"
                      mensajeExito="Borrador descartado"
                      alConfirmar={async () => {
                        await api.delete(`${ENDPOINT}/${d.id}`);
                        await alCambiar();
                        alCambiarId(null);
                      }}
                      disparador={
                        <Button variant="ghost" disabled={enviando}>
                          <Trash2 aria-hidden /> Descartar
                        </Button>
                      }
                    />
                  </div>
                </section>
              ) : (
                <section className="grid gap-2 rounded-lg border p-3 text-sm">
                  <p>
                    Aprobado el {formatoFechaHora(d.aprobado_en)}. Sustento: {d.sustento}
                  </p>
                  {esUltimo ? <NuevaVersion detalle={d} alCrear={(nuevo) => alCambiarId(nuevo)} alCambiar={alCambiar} /> : null}
                </section>
              )}

              <section aria-labelledby="trayectoria">
                <h3 id="trayectoria" className="mb-1 text-sm font-semibold">
                  Trayectoria
                </h3>
                <ol className="grid gap-1 text-sm">
                  {d.trayectoria.map((t) => (
                    <li key={t.id}>
                      <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => alCambiarId(t.id)} aria-current={t.id === d.id}>
                        v{t.version} · {ETIQUETA_ETAPA[t.etapa]} · {t.estado}
                        {t.situacion ? ` · ${ETIQUETA_SITUACION[t.situacion as Situacion] ?? t.situacion}` : ''}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NuevaVersion({ detalle, alCrear, alCambiar }: { detalle: DetalleCierreAnual; alCrear: (id: string) => void; alCambiar: () => unknown }) {
  const [abierto, setAbierto] = useState(false);
  const recuperable = detalle.recuperacionesAprobadas > 0;
  const [etapa, setEtapa] = useState<'rectificacion' | 'recuperacion'>(recuperable ? 'recuperacion' : 'rectificacion');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit">
          {etapa === 'recuperacion' ? <Wand2 aria-hidden /> : <GitBranchPlus aria-hidden />} Nueva versión
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva versión del cierre anual</DialogTitle>
          <DialogDescription>
            Rectificación: vuelve a tomar los últimos logros publicados. Recuperación: incorpora las evaluaciones de recuperación aprobadas ({detalle.recuperacionesAprobadas}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <SelectorCampo
            etiqueta="Etapa"
            valor={etapa}
            alCambiar={(v) => setEtapa((v as 'rectificacion' | 'recuperacion') ?? 'rectificacion')}
            opciones={[
              { valor: 'rectificacion', etiqueta: 'Rectificación' },
              { valor: 'recuperacion', etiqueta: 'Recuperación' },
            ]}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="motivo-version">Motivo</Label>
            <Textarea id="motivo-version" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={enviando || motivo.trim().length < 3}
            onClick={async () => {
              setEnviando(true);
              try {
                const r = await api.post<{ id: string }>(`${ENDPOINT}/${detalle.id}/version`, { etapa, motivo: motivo.trim() });
                toast.success('Versión creada en borrador');
                setAbierto(false);
                await alCambiar();
                alCrear(r.id);
              } catch (e) {
                toast.error(mensajeDeError(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
