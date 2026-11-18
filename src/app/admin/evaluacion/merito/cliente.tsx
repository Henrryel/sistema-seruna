'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Eye, Loader2, Plus, Send, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio, SelectorCampo, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFechaHora } from '@/lib/formato';
import { ALCANCES_MERITO, ETIQUETA_ALCANCE, type DetallePublicacion, type FilaPublicacion } from '@/esquemas/evaluacion/merito';

const ENDPOINT = '/api/admin/evaluacion/merito';

export function ClienteMerito() {
  const recargar = useRecargarListado();
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [detalle, setDetalle] = useState<string | null>(null);
  const parametros = useMemo(() => ({ anioId }), [anioId]);
  return (
    <>
      <EncabezadoPagina
        titulo="Orden de mérito"
        descripcion="La base no calcula el mérito: registre el listado oficial emitido por SIAGIE (archivo y referencia) con sus puestos y publíquelo. Solo Secundaria; el alcance completo usa 5.º grado."
        acciones={anioId ? <DialogoRegistrar anioId={anioId} alRegistrar={() => recargar(ENDPOINT)} /> : null}
      />
      <div className="mb-4 max-w-xs">
        <SelectorAnio anios={anios} anioId={anioId} alCambiar={setAnioId} />
      </div>
      <Tabs defaultValue="listados">
        <TabsList>
          <TabsTrigger value="listados">Listados registrados</TabsTrigger>
          <TabsTrigger value="publicado">Mérito publicado</TabsTrigger>
        </TabsList>
        <TabsContent value="listados">
          {anioId ? (
            <TablaDatos<FilaPublicacion>
              endpoint={ENDPOINT}
              parametros={parametros}
              claveFila={(f) => f.id}
              placeholderBusqueda="Buscar referencia SIAGIE…"
              alSeleccionarFila={(f) => setDetalle(f.id)}
              columnas={[
                { clave: 'grado', titulo: 'Grado', celda: (f) => <span className="font-medium">{`${f.grado}.º ${f.nivel}`}</span> },
                { clave: 'alcance', titulo: 'Alcance', celda: (f) => ETIQUETA_ALCANCE[f.alcance as 'grado'] ?? f.alcance },
                { clave: 'version', titulo: 'Versión', celda: (f) => `v${f.version}` },
                { clave: 'referencia_siagie', titulo: 'Referencia SIAGIE', ocultarEnMovil: true },
                { clave: 'puestos', titulo: 'Puestos' },
                { clave: 'publicado_en', titulo: 'Estado', celda: (f) => (f.publicado_en ? <Etiqueta tono="exito">Publicado</Etiqueta> : <Etiqueta tono="alerta">Borrador</Etiqueta>) },
              ]}
              acciones={(f) => (
                <Button variant="ghost" size="icon-sm" aria-label={`Ver listado v${f.version}`} onClick={() => setDetalle(f.id)}>
                  <Eye aria-hidden />
                </Button>
              )}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="publicado">{anioId ? <MeritoPublicado anioId={anioId} /> : null}</TabsContent>
      </Tabs>
      <DetallePublicacionSheet id={detalle} alCerrar={() => setDetalle(null)} alCambiar={() => recargar(ENDPOINT)} />
    </>
  );
}

function DialogoRegistrar({ anioId, alRegistrar }: { anioId: string; alRegistrar: () => unknown }) {
  const [abierto, setAbierto] = useState(false);
  const grados = useCatalogo('grados', {}, abierto);
  const [gradoId, setGradoId] = useState<string | null>(null);
  const [alcance, setAlcance] = useState<string | null>('grado');
  const [referencia, setReferencia] = useState('');
  const archivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const secundaria = (grados.data ?? []).filter((g) => g.extra?.nivel === 'secundaria');
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <Upload aria-hidden /> Registrar listado oficial
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar listado de mérito de SIAGIE</DialogTitle>
          <DialogDescription>Adjunte el archivo oficial descargado de SIAGIE e indique su referencia. Se crea una nueva versión sin publicar.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = archivo.current?.files?.[0];
            if (!gradoId || !alcance || !referencia.trim() || !f) return toast.error('Complete todos los campos y adjunte el archivo');
            const datos = new FormData();
            datos.set('anioId', anioId);
            datos.set('gradoId', gradoId);
            datos.set('alcance', alcance);
            datos.set('referenciaSiagie', referencia.trim());
            datos.set('archivo', f);
            setEnviando(true);
            try {
              await api.post(ENDPOINT, datos);
              toast.success('Listado registrado');
              await alRegistrar();
              setAbierto(false);
            } catch (err) {
              toast.error(mensajeDeError(err));
            } finally {
              setEnviando(false);
            }
          }}
        >
          <SelectorCampo etiqueta="Grado (Secundaria)" valor={gradoId} alCambiar={setGradoId} opciones={secundaria} cargando={grados.isPending} />
          <SelectorCampo etiqueta="Alcance" valor={alcance} alCambiar={setAlcance} opciones={ALCANCES_MERITO.map((a) => ({ valor: a, etiqueta: ETIQUETA_ALCANCE[a] }))} />
          <div className="grid gap-1.5">
            <Label htmlFor="referencia-siagie">Referencia SIAGIE</Label>
            <Input id="referencia-siagie" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N.º de reporte, fecha de descarga…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="archivo-siagie">Archivo oficial (PDF o Excel)</Label>
            <Input id="archivo-siagie" ref={archivo} type="file" accept="application/pdf,.xlsx,.xls" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetallePublicacionSheet({ id, alCerrar, alCambiar }: { id: string | null; alCerrar: () => void; alCambiar: () => unknown }) {
  const qc = useQueryClient();
  const clave = ['merito', id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetallePublicacion>(`${ENDPOINT}/${id}`), enabled: Boolean(id) });
  const d = consulta.data;
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await alCambiar();
  };
  const [matriculaId, setMatriculaId] = useState<string | null>(null);
  const [puesto, setPuesto] = useState('');
  const [calificativo, setCalificativo] = useState('');
  const [sustento, setSustento] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (d) setPuesto(String(d.puestosDetalle.length + 1));
  }, [d]);
  const publicado = Boolean(d?.publicado_en);

  return (
    <Sheet open={Boolean(id)} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{d ? `Mérito ${d.anio} · ${d.grado}.º ${d.nivel} · v${d.version}` : 'Listado de mérito'}</SheetTitle>
          <SheetDescription>{d ? `${ETIQUETA_ALCANCE[d.alcance as 'grado'] ?? d.alcance} · Referencia ${d.referencia_siagie}` : ''}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {consulta.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : consulta.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {mensajeDeError(consulta.error)}
            </p>
          ) : d ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {publicado ? <Etiqueta tono="exito">Publicado {formatoFechaHora(d.publicado_en)}</Etiqueta> : <Etiqueta tono="alerta">Sin publicar</Etiqueta>}
                <Button variant="outline" size="sm" asChild>
                  <a href={`${ENDPOINT}/${d.id}/archivo`} download>
                    <Download aria-hidden /> {d.archivo}
                  </a>
                </Button>
                {!publicado ? (
                  <>
                    <Confirmar
                      titulo="¿Publicar el listado?"
                      descripcion="Se exige que los puestos sean consecutivos desde el 1. Luego el listado es inmutable (registre una nueva versión para corregir)."
                      textoConfirmar="Publicar"
                      mensajeExito="Mérito publicado"
                      alConfirmar={async () => {
                        await api.post(`${ENDPOINT}/${d.id}/publicar`);
                        await refrescar();
                      }}
                      disparador={
                        <Button size="sm">
                          <Send aria-hidden /> Publicar
                        </Button>
                      }
                    />
                    <Confirmar
                      titulo="¿Eliminar este listado sin publicar?"
                      destructivo
                      textoConfirmar="Eliminar"
                      mensajeExito="Listado eliminado"
                      alConfirmar={async () => {
                        await api.delete(`${ENDPOINT}/${d.id}`);
                        await alCambiar();
                        alCerrar();
                      }}
                      disparador={
                        <Button size="sm" variant="ghost">
                          <Trash2 aria-hidden /> Eliminar
                        </Button>
                      }
                    />
                  </>
                ) : null}
              </div>

              {!publicado ? (
                <form
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!matriculaId) return toast.error('Elija el estudiante');
                    setEnviando(true);
                    try {
                      await api.post(`${ENDPOINT}/${d.id}/puestos`, {
                        puestos: [{ matriculaId, puesto: Number(puesto), calificativo, sustentoDesempate: sustento || null }],
                      });
                      toast.success('Puesto registrado');
                      setMatriculaId(null);
                      setCalificativo('');
                      setSustento('');
                      await refrescar();
                    } catch (err) {
                      toast.error(mensajeDeError(err));
                    } finally {
                      setEnviando(false);
                    }
                  }}
                >
                  <SelectorCampo
                    className="sm:col-span-2"
                    etiqueta="Estudiante (cierre lectivo aprobado)"
                    valor={matriculaId}
                    alCambiar={setMatriculaId}
                    opciones={d.candidatos.map((c) => ({ valor: c.matricula_id, etiqueta: `${c.alumno} · ${c.codigo_siagie ?? c.codigo}${c.seccion ? ` · ${c.seccion}` : ''}` }))}
                    placeholder={d.candidatos.length ? 'Seleccione' : 'Sin candidatos'}
                  />
                  <div className="grid gap-1.5">
                    <Label htmlFor="puesto">Puesto</Label>
                    <Input id="puesto" type="number" min={1} value={puesto} onChange={(e) => setPuesto(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="calificativo">Calificativo (2.5–10)</Label>
                    <Input id="calificativo" inputMode="decimal" value={calificativo} onChange={(e) => setCalificativo(e.target.value)} placeholder="Según SIAGIE" />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="desempate">Sustento de desempate (opcional)</Label>
                    <Input id="desempate" value={sustento} onChange={(e) => setSustento(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={enviando} className="sm:col-span-2 sm:w-fit">
                    {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Agregar o reemplazar puesto
                  </Button>
                </form>
              ) : null}

              {d.puestosDetalle.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Puesto</TableHead>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Calificativo</TableHead>
                        {!publicado ? <TableHead className="text-right">Quitar</TableHead> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.puestosDetalle.map((p) => (
                        <TableRow key={p.matricula_id}>
                          <TableCell className="font-semibold">{p.puesto}.º</TableCell>
                          <TableCell>
                            <p>{p.alumno}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.codigo_siagie ?? p.codigo}
                              {p.sustento_desempate ? ` · Desempate: ${p.sustento_desempate}` : ''}
                            </p>
                          </TableCell>
                          <TableCell>{p.calificativo}</TableCell>
                          {!publicado ? (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Quitar a ${p.alumno}`}
                                onClick={async () => {
                                  try {
                                    await api.delete(conConsulta(`${ENDPOINT}/${d.id}/puestos`, { matriculaId: p.matricula_id }));
                                    await refrescar();
                                  } catch (err) {
                                    toast.error(mensajeDeError(err));
                                  }
                                }}
                              >
                                <X aria-hidden />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EstadoVacio titulo="Sin puestos" descripcion="Registre los puestos tal como figuran en el listado oficial de SIAGIE." />
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface PuestoPublicado {
  publicacion_id: string;
  grado: number;
  alcance: string;
  version: number;
  publicado_en: string | null;
  referencia_siagie: string;
  matricula_id: string;
  codigo: string;
  alumno: string;
  puesto: number;
  calificativo: string;
}

function MeritoPublicado({ anioId }: { anioId: string }) {
  const consulta = useQuery({ queryKey: ['merito-publicado', anioId], queryFn: () => api.get<{ puestos: PuestoPublicado[] }>(conConsulta(`${ENDPOINT}/publicado`, { anioId })) });
  if (consulta.isPending) return <Skeleton className="h-32 w-full" />;
  if (consulta.isError) return <p role="alert" className="text-sm text-destructive">{mensajeDeError(consulta.error)}</p>;
  const grupos = new Map<string, PuestoPublicado[]>();
  for (const p of consulta.data.puestos) grupos.set(p.publicacion_id, [...(grupos.get(p.publicacion_id) ?? []), p]);
  if (!grupos.size) return <EstadoVacio titulo="Sin mérito publicado" descripcion="Aún no se publica ningún listado para el año." />;
  return (
    <div className="grid gap-4">
      {[...grupos.values()].map((lista) => {
        const p = lista[0];
        if (!p) return null;
        return (
          <section key={p.publicacion_id} className="rounded-lg border p-3">
            <h3 className="font-semibold">
              {p.grado}.º Secundaria · {ETIQUETA_ALCANCE[p.alcance as 'grado'] ?? p.alcance} · v{p.version}
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Ref. {p.referencia_siagie} · publicado {formatoFechaHora(p.publicado_en)}
            </p>
            <ol className="grid gap-1 text-sm">
              {lista.map((x) => (
                <li key={x.matricula_id}>
                  <span className="font-semibold">{x.puesto}.º</span> {x.alumno} <span className="text-muted-foreground">({x.calificativo})</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
