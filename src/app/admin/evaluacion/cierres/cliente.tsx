'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCheck, Eye, FolderOpen, Loader2, Lock, LockOpen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio, SelectorCampo, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFechaHora } from '@/lib/formato';
import { ESTADOS_CIERRE, type DetalleCierre, type FilaCierre, type ResultadoLote } from '@/esquemas/evaluacion/cierres';
import type { RespuestaListado } from '@/esquemas/comunes';

const ENDPOINT = '/api/admin/evaluacion/cierres';
const MOTIVO: Record<string, string> = { sin_nota: 'Sin nota', pendiente: 'Pendiente', sin_conclusion: 'Falta conclusión' };

export function ClienteCierres() {
  const recargar = useRecargarListado();
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [bimestreId, setBimestreId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const bimestres = useCatalogo('bimestres', { anioId: anioId ?? undefined }, Boolean(anioId));
  const parametros = useMemo(() => ({ anioId, bimestreId }), [anioId, bimestreId]);
  const accion = async (id: string, a: 'cerrar' | 'publicar' | 'reabrir', motivo?: string) => {
    await api.post(`${ENDPOINT}/${id}`, { accion: a, motivo });
    await recargar(ENDPOINT);
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Cierres de bimestre"
        descripcion="Abra el registro de notas, controle el avance por sección y cierre, publique o reabra cada bimestre. La base verifica que no falten notas ni conclusiones obligatorias."
        acciones={
          anioId ? (
            <>
              <DialogoAbrir anioId={anioId} alAbrir={() => recargar(ENDPOINT)} />
              <DialogoLote anioId={anioId} alTerminar={() => recargar(ENDPOINT)} />
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
            setBimestreId(null);
          }}
        />
        <SelectorCampo etiqueta="Bimestre" valor={bimestreId} alCambiar={setBimestreId} opciones={bimestres.data ?? []} opcionVacia="Todos" deshabilitado={!anioId} />
      </div>
      {anioId ? (
        <TablaDatos<FilaCierre>
          endpoint={ENDPOINT}
          parametros={parametros}
          claveFila={(f) => f.id}
          placeholderBusqueda="Buscar sección…"
          filtros={[{ nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ESTADOS_CIERRE.map((e) => ({ valor: e, etiqueta: e.charAt(0).toUpperCase() + e.slice(1) })) }]}
          alSeleccionarFila={(f) => setDetalle(f.id)}
          columnas={[
            { clave: 'bimestre', titulo: 'Bim.', celda: (f) => `${f.bimestre}.º` },
            { clave: 'seccion', titulo: 'Sección', celda: (f) => <span className="font-medium">{`${f.grado}.º ${f.seccion} · ${f.nivel}`}</span> },
            { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
            {
              clave: 'avance',
              titulo: 'Avance',
              celda: (f) => (
                <div className="grid min-w-32 gap-1">
                  <Progress value={f.avance} aria-label={`Avance ${f.avance} %`} />
                  <span className="text-xs text-muted-foreground">
                    {f.completas}/{f.esperadas} notas{f.sin_conclusion ? ` · ${f.sin_conclusion} sin conclusión` : ''}
                    {f.pendientes ? ` · ${f.pendientes} pendientes` : ''}
                  </span>
                </div>
              ),
            },
            { clave: 'publicado_en', titulo: 'Publicado', celda: (f) => formatoFechaHora(f.publicado_en), ocultarEnMovil: true },
            { clave: 'responsable', titulo: 'Responsable', ocultarEnMovil: true },
          ]}
          acciones={(f) => (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={`Ver avance de ${f.grado}.º ${f.seccion}`} onClick={() => setDetalle(f.id)}>
                <Eye aria-hidden />
              </Button>
              {f.estado === 'borrador' ? (
                <Confirmar
                  titulo={`¿Cerrar el ${f.bimestre}.º bimestre de ${f.grado}.º ${f.seccion}?`}
                  descripcion="Al cerrar ya no se pueden registrar ni rectificar notas, salvo que se reabra."
                  textoConfirmar="Cerrar"
                  mensajeExito="Bimestre cerrado"
                  alConfirmar={() => accion(f.id, 'cerrar')}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label="Cerrar bimestre">
                      <Lock aria-hidden />
                    </Button>
                  }
                />
              ) : null}
              {f.estado === 'cerrado' ? (
                <Confirmar
                  titulo="¿Publicar el bimestre?"
                  descripcion="Los estudiantes y apoderados con acceso académico verán los logros y conclusiones."
                  textoConfirmar="Publicar"
                  mensajeExito="Bimestre publicado"
                  alConfirmar={() => accion(f.id, 'publicar')}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label="Publicar bimestre">
                      <Send aria-hidden />
                    </Button>
                  }
                />
              ) : null}
              {f.estado !== 'borrador' ? (
                <Confirmar
                  titulo="¿Reabrir el bimestre?"
                  descripcion="Vuelve a borrador (se retira la publicación) para permitir rectificaciones. Queda registrado en la bitácora."
                  pedirMotivo
                  etiquetaMotivo="Motivo de la reapertura"
                  destructivo
                  textoConfirmar="Reabrir"
                  mensajeExito="Bimestre reabierto"
                  alConfirmar={(motivo) => accion(f.id, 'reabrir', motivo)}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label="Reabrir bimestre">
                      <LockOpen aria-hidden />
                    </Button>
                  }
                />
              ) : null}
            </>
          )}
          vacio={<EstadoVacio titulo="Sin cierres" descripcion="Use «Abrir registro» para habilitar el registro de notas de un bimestre." />}
        />
      ) : null}
      <DetalleCierreSheet id={detalle} alCerrar={() => setDetalle(null)} />
    </>
  );
}

function DialogoAbrir({ anioId, alAbrir }: { anioId: string; alAbrir: () => unknown }) {
  const [abierto, setAbierto] = useState(false);
  const [bimestreId, setBimestreId] = useState<string | null>(null);
  const [todas, setTodas] = useState(true);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const bimestres = useCatalogo('bimestres', { anioId }, abierto);
  const secciones = useCatalogo('secciones', { anioId }, abierto);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <FolderOpen aria-hidden /> Abrir registro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir registro de notas</DialogTitle>
          <DialogDescription>Crea el cierre en borrador de cada sección para el bimestre. Las que ya lo tienen se omiten.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <SelectorCampo etiqueta="Bimestre" valor={bimestreId} alCambiar={setBimestreId} opciones={bimestres.data ?? []} cargando={bimestres.isPending} />
          <div className="flex items-center gap-2">
            <Checkbox id="todas-secciones" checked={todas} onCheckedChange={(v) => setTodas(v === true)} />
            <Label htmlFor="todas-secciones">Todas las secciones activas del año</Label>
          </div>
          {!todas ? (
            <fieldset className="grid max-h-60 gap-2 overflow-y-auto rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Secciones</legend>
              {(secciones.data ?? []).map((s) => (
                <div key={s.valor} className="flex items-center gap-2">
                  <Checkbox
                    id={`sec-${s.valor}`}
                    checked={elegidas.includes(s.valor)}
                    onCheckedChange={(v) => setElegidas((l) => (v === true ? [...l, s.valor] : l.filter((x) => x !== s.valor)))}
                  />
                  <Label htmlFor={`sec-${s.valor}`} className="font-normal">
                    {s.etiqueta}
                  </Label>
                </div>
              ))}
            </fieldset>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!bimestreId || enviando || (!todas && !elegidas.length)}
            onClick={async () => {
              setEnviando(true);
              try {
                const r = await api.post<{ creados: number }>(ENDPOINT, { bimestreId, seccionIds: todas ? undefined : elegidas });
                toast.success(r.creados ? `Registro abierto en ${r.creados} sección(es)` : 'Todas las secciones ya tenían el registro abierto');
                await alAbrir();
                setAbierto(false);
              } catch (e) {
                toast.error(mensajeDeError(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACCIONES_LOTE = [
  { valor: 'cerrar', etiqueta: 'Cerrar todos los borradores', estado: 'borrador' },
  { valor: 'publicar', etiqueta: 'Publicar todos los cerrados', estado: 'cerrado' },
] as const;

function DialogoLote({ anioId, alTerminar }: { anioId: string; alTerminar: () => unknown }) {
  const [abierto, setAbierto] = useState(false);
  const [bimestreId, setBimestreId] = useState<string | null>(null);
  const [accion, setAccion] = useState<'cerrar' | 'publicar'>('cerrar');
  const [resultados, setResultados] = useState<(ResultadoLote & { seccion: string })[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const bimestres = useCatalogo('bimestres', { anioId }, abierto);
  const definicion = ACCIONES_LOTE.find((a) => a.valor === accion) ?? ACCIONES_LOTE[0];
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
          <CheckCheck aria-hidden /> Acción masiva
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acción masiva por bimestre</DialogTitle>
          <DialogDescription>Cada sección se procesa por separado; las que no cumplan las reglas de la base quedan sin cambios.</DialogDescription>
        </DialogHeader>
        {resultados ? (
          <ul className="grid gap-1 text-sm" aria-live="polite">
            {resultados.length === 0 ? <li>No había secciones en ese estado.</li> : null}
            {resultados.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <Etiqueta tono={r.ok ? 'exito' : 'peligro'}>{r.ok ? 'Listo' : 'Error'}</Etiqueta>
                <span>
                  {r.seccion}
                  {r.ok ? '' : `: ${r.mensaje}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-4">
            <SelectorCampo etiqueta="Bimestre" valor={bimestreId} alCambiar={setBimestreId} opciones={bimestres.data ?? []} cargando={bimestres.isPending} />
            <SelectorCampo
              etiqueta="Acción"
              valor={accion}
              alCambiar={(v) => setAccion((v as 'cerrar' | 'publicar') ?? 'cerrar')}
              opciones={ACCIONES_LOTE.map((a) => ({ valor: a.valor, etiqueta: a.etiqueta }))}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            {resultados ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!resultados ? (
            <Button
              disabled={!bimestreId || enviando}
              onClick={async () => {
                setEnviando(true);
                try {
                  const lista = await api.get<RespuestaListado<FilaCierre>>(conConsulta(ENDPOINT, { anioId, bimestreId, estado: definicion.estado, porPagina: 200 }));
                  const nombres = new Map(lista.filas.map((f) => [f.id, `${f.grado}.º ${f.seccion} ${f.nivel}`]));
                  if (!lista.filas.length) {
                    setResultados([]);
                    return;
                  }
                  const r = await api.post<{ resultados: ResultadoLote[] }>(`${ENDPOINT}/lote`, { ids: lista.filas.map((f) => f.id), accion });
                  setResultados(r.resultados.map((x) => ({ ...x, seccion: nombres.get(x.id) ?? x.id })));
                  await alTerminar();
                } catch (e) {
                  toast.error(mensajeDeError(e));
                } finally {
                  setEnviando(false);
                }
              }}
            >
              {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null} Ejecutar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalleCierreSheet({ id, alCerrar }: { id: string | null; alCerrar: () => void }) {
  const consulta = useQuery({ queryKey: ['cierre-detalle', id], queryFn: () => api.get<DetalleCierre>(`${ENDPOINT}/${id}`), enabled: Boolean(id) });
  const d = consulta.data;
  return (
    <Sheet open={Boolean(id)} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{d ? `${d.bimestre}.º bimestre · ${d.grado}.º ${d.seccion} ${d.nivel}` : 'Avance del cierre'}</SheetTitle>
          <SheetDescription>Notas que faltan o impiden cerrar (nómina al cierre del bimestre × competencias del plan).</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {consulta.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : consulta.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {mensajeDeError(consulta.error)}
            </p>
          ) : d ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <BadgeEstado estado={d.estado} />
                <span>
                  {d.completas}/{d.esperadas} notas ({d.avance} %)
                </span>
                {d.sin_conclusion ? <Etiqueta tono="peligro">{d.sin_conclusion} sin conclusión</Etiqueta> : null}
              </div>
              <Progress value={d.avance} aria-label={`Avance ${d.avance} %`} />
              {d.faltantes.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Competencia</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.faltantes.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell>{f.alumno}</TableCell>
                          <TableCell className="text-xs">{f.competencia}</TableCell>
                          <TableCell>
                            <Etiqueta tono={f.motivo === 'sin_nota' ? 'alerta' : 'peligro'}>{MOTIVO[f.motivo]}</Etiqueta>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {d.totalFaltantes > d.faltantes.length ? <p className="p-2 text-xs text-muted-foreground">Se muestran {d.faltantes.length} de {d.totalFaltantes}.</p> : null}
                </div>
              ) : (
                <EstadoVacio titulo="Registro completo" descripcion="No faltan notas ni conclusiones obligatorias." />
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
