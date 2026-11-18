'use client';
import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, Download, Eye, FileCog, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio, SelectorBimestre, SelectorCampo, SelectorSeccion, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import { letraColumna, type DetallePlantilla, type FilaPlantilla, type ResultadoGeneracionSiagie } from '@/esquemas/evaluacion/siagie';

const ENDPOINT = '/api/admin/evaluacion/siagie';

export function ClienteSiagie() {
  const recargar = useRecargarListado();
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [seccionId, setSeccionId] = useState<string | null>(null);
  const [bimestreId, setBimestreId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const parametros = useMemo(() => ({ anioId, seccionId, bimestreId }), [anioId, seccionId, bimestreId]);
  const listado = `${ENDPOINT}/plantillas`;
  return (
    <>
      <EncabezadoPagina
        titulo="Exportación SIAGIE"
        descripcion="Suba la plantilla oficial de cada sección y bimestre, mapee las competencias a sus columnas y genere el Excel con los logros publicados."
        acciones={anioId ? <DialogoSubir anioId={anioId} alSubir={() => recargar(listado)} /> : null}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <SelectorAnio
          anios={anios}
          anioId={anioId}
          alCambiar={(v) => {
            setAnioId(v);
            setSeccionId(null);
            setBimestreId(null);
          }}
        />
        <SelectorSeccion anioId={anioId} valor={seccionId} alCambiar={setSeccionId} opcionVacia="Todas" />
        <SelectorBimestre anioId={anioId} valor={bimestreId} alCambiar={setBimestreId} opcionVacia="Todos" />
      </div>
      {anioId ? (
        <TablaDatos<FilaPlantilla>
          endpoint={listado}
          parametros={parametros}
          claveFila={(f) => f.id}
          placeholderBusqueda="Buscar sección o archivo…"
          alSeleccionarFila={(f) => setDetalle(f.id)}
          columnas={[
            { clave: 'bimestre', titulo: 'Bim.', celda: (f) => `${f.bimestre}.º` },
            { clave: 'seccion', titulo: 'Sección', celda: (f) => <span className="font-medium">{`${f.grado}.º ${f.seccion} · ${f.nivel}`}</span> },
            { clave: 'version', titulo: 'Versión', celda: (f) => `v${f.version}`, ocultarEnMovil: true },
            { clave: 'archivo', titulo: 'Archivo', ocultarEnMovil: true },
            { clave: 'mapeos', titulo: 'Mapeos' },
            { clave: 'cierre_estado', titulo: 'Bimestre', celda: (f) => <BadgeEstado estado={f.cierre_estado ?? 'sin registro'} /> },
          ]}
          acciones={(f) => (
            <Button variant="ghost" size="icon-sm" aria-label="Ver plantilla" onClick={() => setDetalle(f.id)}>
              <Eye aria-hidden />
            </Button>
          )}
          vacio={<EstadoVacio titulo="Sin plantillas" descripcion="Suba el Excel oficial de SIAGIE de una sección y bimestre." />}
        />
      ) : null}
      <DetalleSheet id={detalle} alCerrar={() => setDetalle(null)} alCambiar={() => recargar(listado)} />
    </>
  );
}

function DialogoSubir({ anioId, alSubir }: { anioId: string; alSubir: () => unknown }) {
  const [abierto, setAbierto] = useState(false);
  const [seccionId, setSeccionId] = useState<string | null>(null);
  const [bimestreId, setBimestreId] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <Upload aria-hidden /> Subir plantilla
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir plantilla oficial SIAGIE</DialogTitle>
          <DialogDescription>Archivo .xlsx descargado de SIAGIE para la sección y el bimestre. Cada carga crea una nueva versión.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = archivo.current?.files?.[0];
            if (!seccionId || !bimestreId || !f) return toast.error('Elija sección, bimestre y archivo');
            const datos = new FormData();
            datos.set('seccionId', seccionId);
            datos.set('bimestreId', bimestreId);
            datos.set('archivo', f);
            setEnviando(true);
            try {
              const r = await api.post<{ version: number; hojas: string[] }>(`${ENDPOINT}/plantillas`, datos);
              toast.success(`Plantilla v${r.version} cargada (${r.hojas.length} hoja(s))`);
              await alSubir();
              setAbierto(false);
            } catch (err) {
              toast.error(mensajeDeError(err));
            } finally {
              setEnviando(false);
            }
          }}
        >
          <SelectorSeccion anioId={anioId} valor={seccionId} alCambiar={setSeccionId} />
          <SelectorBimestre anioId={anioId} valor={bimestreId} alCambiar={setBimestreId} />
          <div className="grid gap-1.5">
            <Label htmlFor="plantilla-siagie">Plantilla (.xlsx)</Label>
            <Input id="plantilla-siagie" ref={archivo} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Subir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetalleSheet({ id, alCerrar, alCambiar }: { id: string | null; alCerrar: () => void; alCambiar: () => unknown }) {
  const qc = useQueryClient();
  const clave = ['siagie-plantilla', id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetallePlantilla>(`${ENDPOINT}/plantillas/${id}`), enabled: Boolean(id) });
  const d = consulta.data;
  const [ocupado, setOcupado] = useState(false);
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await alCambiar();
  };
  const ejecutar = async (fn: () => Promise<unknown>) => {
    setOcupado(true);
    try {
      await fn();
      await refrescar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const generar = (exportacionId: string) =>
    ejecutar(async () => {
      const r = await api.post<ResultadoGeneracionSiagie>(`${ENDPOINT}/exportaciones/${exportacionId}/generar`);
      if (r.advertencias.length) toast.warning(`Excel generado con ${r.advertencias.length} advertencia(s): ${r.advertencias[0]}`);
      else toast.success(`Excel generado: ${r.escritas} nota(s) escritas`);
    });

  return (
    <Sheet open={Boolean(id)} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{d ? `${d.grado}.º ${d.seccion} ${d.nivel} · ${d.bimestre}.º bimestre ${d.anio} · v${d.version}` : 'Plantilla SIAGIE'}</SheetTitle>
          <SheetDescription>
            Columnas en numeración Excel (A = 1). El nivel de logro va en una columna par desde la D (4) y la conclusión en la siguiente. La fila del estudiante se
            ubica por su código SIAGIE en las columnas previas a la primera columna de nivel.
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
                <BadgeEstado estado={d.cierre_estado ?? 'sin registro'} />
                <Button variant="outline" size="sm" asChild>
                  <a href={`${ENDPOINT}/plantillas/${d.id}/archivo`} download>
                    <Download aria-hidden /> {d.archivo}
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">Hojas: {d.hojas.join(', ') || '—'}</span>
              </div>

              <section aria-labelledby="mapeos" className="grid gap-2">
                <h3 id="mapeos" className="text-sm font-semibold">
                  Mapeo de competencias
                </h3>
                {d.mapeosDetalle.length ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Competencia</TableHead>
                          <TableHead>Hoja</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>NL</TableHead>
                          <TableHead>Concl.</TableHead>
                          <TableHead className="text-right">Quitar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.mapeosDetalle.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">{m.competencia}</TableCell>
                            <TableCell>{m.hoja}</TableCell>
                            <TableCell>{m.codigo_excel}</TableCell>
                            <TableCell>{`${letraColumna(m.columna_nl)} (${m.columna_nl})`}</TableCell>
                            <TableCell>{letraColumna(m.columna_conclusion)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Quitar mapeo de ${m.competencia}`}
                                disabled={ocupado}
                                onClick={() => ejecutar(() => api.delete(conConsulta(`${ENDPOINT}/plantillas/${d.id}/mapeos`, { mapeoId: m.id })))}
                              >
                                <Trash2 aria-hidden />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin mapeos. Las competencias reportables a SIAGIE deben mapearse todas.</p>
                )}
                <FormularioMapeo detalle={d} ocupado={ocupado} ejecutar={ejecutar} />
                {d.otrasPlantillas.length ? <CopiarMapeos detalle={d} ocupado={ocupado} ejecutar={ejecutar} /> : null}
              </section>

              <section aria-labelledby="exportaciones" className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="exportaciones" className="text-sm font-semibold">
                    Exportaciones
                  </h3>
                  <Button
                    size="sm"
                    className="ml-auto"
                    disabled={ocupado}
                    onClick={() =>
                      ejecutar(async () => {
                        const exp = await api.post<{ id: string }>(`${ENDPOINT}/plantillas/${d.id}/exportaciones`);
                        const r = await api.post<ResultadoGeneracionSiagie>(`${ENDPOINT}/exportaciones/${exp.id}/generar`);
                        if (r.advertencias.length) toast.warning(`Excel generado con ${r.advertencias.length} advertencia(s): ${r.advertencias[0]}`);
                        else toast.success(`Excel generado: ${r.escritas} nota(s) escritas`);
                      })
                    }
                  >
                    {ocupado ? <Loader2 className="animate-spin" aria-hidden /> : <FileCog aria-hidden />} Preparar y generar Excel
                  </Button>
                </div>
                {d.exportacionesDetalle.length ? (
                  <ul className="grid gap-2">
                    {d.exportacionesDetalle.map((x) => (
                      <li key={x.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <BadgeEstado estado={x.estado} />
                          <span>
                            #{x.id} · {x.notas} nota(s) · {x.solicitado_por} · {formatoFechaHora(x.solicitado_en)}
                          </span>
                          <div className="ml-auto flex flex-wrap gap-1">
                            {x.estado === 'preparada' ? (
                              <Button size="sm" variant="outline" disabled={ocupado} onClick={() => generar(x.id)}>
                                <FileCog aria-hidden /> Generar
                              </Button>
                            ) : null}
                            {x.resultado_archivo_id ? (
                              <Button size="sm" variant="outline" asChild>
                                <a href={`${ENDPOINT}/exportaciones/${x.id}/archivo`} download>
                                  <Download aria-hidden /> Excel
                                </a>
                              </Button>
                            ) : null}
                            {x.estado === 'generada' ? (
                              <Confirmar
                                titulo="¿Marcar como aceptada por SIAGIE?"
                                pedirMotivo
                                etiquetaMotivo="Observación (constancia de carga)"
                                textoConfirmar="Aceptada"
                                mensajeExito="Exportación aceptada"
                                alConfirmar={async (obs) => {
                                  await api.post(`${ENDPOINT}/exportaciones/${x.id}/resolver`, { estado: 'aceptada', observacion: obs });
                                  await refrescar();
                                }}
                                disparador={
                                  <Button size="sm" variant="outline">
                                    <Check aria-hidden /> Aceptada
                                  </Button>
                                }
                              />
                            ) : null}
                            {x.estado === 'generada' || x.estado === 'preparada' ? (
                              <Confirmar
                                titulo="¿Marcar como rechazada?"
                                pedirMotivo
                                etiquetaMotivo="Motivo del rechazo"
                                destructivo
                                textoConfirmar="Rechazada"
                                mensajeExito="Exportación rechazada"
                                alConfirmar={async (obs) => {
                                  await api.post(`${ENDPOINT}/exportaciones/${x.id}/resolver`, { estado: 'rechazada', observacion: obs });
                                  await refrescar();
                                }}
                                disparador={
                                  <Button size="sm" variant="ghost">
                                    <X aria-hidden /> Rechazada
                                  </Button>
                                }
                              />
                            ) : null}
                          </div>
                        </div>
                        {x.observacion ? <p className="text-xs text-muted-foreground">{x.observacion}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aún no hay exportaciones. Requiere el bimestre publicado, los mapeos completos y el código SIAGIE de cada estudiante.</p>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FormularioMapeo({ detalle, ocupado, ejecutar }: { detalle: DetallePlantilla; ocupado: boolean; ejecutar: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [competenciaId, setCompetenciaId] = useState<string | null>(null);
  const [hoja, setHoja] = useState<string | null>(detalle.hojas[0] ?? null);
  const [codigo, setCodigo] = useState('');
  const [columna, setColumna] = useState('4');
  const n = Number(columna);
  const valida = Number.isInteger(n) && n >= 4 && n % 2 === 0;
  return (
    <form
      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!competenciaId || !hoja) return toast.error('Elija competencia y hoja');
        void ejecutar(async () => {
          await api.post(`${ENDPOINT}/plantillas/${detalle.id}/mapeos`, { competenciaId, hoja, codigoExcel: codigo.trim(), columnaNl: n });
          toast.success('Mapeo agregado');
          setCompetenciaId(null);
          setCodigo('');
          setColumna(String(n + 2));
        });
      }}
    >
      <SelectorCampo
        className="sm:col-span-2"
        etiqueta="Competencia"
        valor={competenciaId}
        alCambiar={setCompetenciaId}
        opciones={detalle.competencias
          .filter((k) => !k.mapeada)
          .map((k) => ({ valor: k.id, etiqueta: `${k.codigo} · ${k.nombre}${k.reportable_siagie ? '' : ' (no reportable)'}` }))}
        placeholder={detalle.competencias.some((k) => !k.mapeada) ? 'Seleccione' : 'Todas mapeadas'}
      />
      {detalle.hojas.length ? (
        <SelectorCampo etiqueta="Hoja" valor={hoja} alCambiar={setHoja} opciones={detalle.hojas.map((h) => ({ valor: h, etiqueta: h }))} />
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="hoja">Hoja</Label>
          <Input id="hoja" value={hoja ?? ''} onChange={(e) => setHoja(e.target.value)} maxLength={31} />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="codigo-excel">Código en la plantilla</Label>
        <Input id="codigo-excel" inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="columna-nl">Columna del nivel de logro (número)</Label>
        <Input id="columna-nl" type="number" min={4} step={2} value={columna} onChange={(e) => setColumna(e.target.value)} aria-describedby="columna-ayuda" />
        <p id="columna-ayuda" className={`text-xs ${valida ? 'text-muted-foreground' : 'text-destructive'}`}>
          {valida ? `NL en ${letraColumna(n)}, conclusión en ${letraColumna(n + 1)}` : 'Debe ser un número par desde 4 (columna D)'}
        </p>
      </div>
      <Button type="submit" disabled={ocupado || !valida || !codigo} className="self-end sm:w-fit">
        <Plus aria-hidden /> Agregar mapeo
      </Button>
    </form>
  );
}

function CopiarMapeos({ detalle, ocupado, ejecutar }: { detalle: DetallePlantilla; ocupado: boolean; ejecutar: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [desde, setDesde] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <SelectorCampo
        className="flex-1"
        etiqueta="Copiar mapeos desde otra plantilla del grado"
        valor={desde}
        alCambiar={setDesde}
        opciones={detalle.otrasPlantillas.map((o) => ({ valor: o.id, etiqueta: o.etiqueta }))}
      />
      <Button
        variant="outline"
        disabled={!desde || ocupado}
        onClick={() =>
          ejecutar(async () => {
            const r = await api.post<{ copiados: number }>(`${ENDPOINT}/plantillas/${detalle.id}/mapeos/copiar`, { desdePlantillaId: desde });
            toast.success(`${r.copiados} mapeo(s) copiados`);
          })
        }
      >
        <Copy aria-hidden /> Copiar
      </Button>
    </div>
  );
}
