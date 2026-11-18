'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, History, Info, Loader2, Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BadgeEstado, BadgeNivelLogro, Etiqueta } from '@/components/datos/badges';
import { EstadoVacio } from '@/components/datos/basicos';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { NIVELES_LOGRO, type NivelLogro } from '@/esquemas/comunes';
import {
  requiereConclusion,
  type AlumnoGrilla,
  type FilaRevision,
  type GrillaCalificaciones,
  type ResultadoGuardado,
} from '@/esquemas/evaluacion/calificaciones';

export interface ValorCelda {
  estado: 'evaluada' | 'no_desarrollada';
  nivelLogro: NivelLogro | null;
  conclusion: string | null;
}

export interface CeldaEnvio extends ValorCelda {
  matriculaId: string;
  competenciaId: string;
}

const clave = (m: string, k: string) => `${m}:${k}`;
const OPCIONES: { valor: NivelLogro | 'ND'; texto: string; titulo: string }[] = [
  ...NIVELES_LOGRO.map((n) => ({ valor: n, texto: n, titulo: { AD: 'Logro destacado', A: 'Logro esperado', B: 'En proceso', C: 'En inicio' }[n] })),
  { valor: 'ND', texto: 'ND', titulo: 'No desarrollada en el bimestre' },
];

function original(a: AlumnoGrilla, competenciaId: string): ValorCelda | null {
  const c = a.calificaciones[competenciaId];
  if (!c || c.estado === 'pendiente') return null;
  return { estado: c.estado as ValorCelda['estado'], nivelLogro: c.nivel_logro, conclusion: c.conclusion };
}

const mismo = (a: ValorCelda | null, b: ValorCelda | null) =>
  (a?.estado ?? null) === (b?.estado ?? null) && (a?.nivelLogro ?? null) === (b?.nivelLogro ?? null) && (a?.conclusion?.trim() || null) === (b?.conclusion?.trim() || null);

/**
 * Grilla de calificaciones por competencia (AD/A/B/C, no desarrollada y conclusión descriptiva).
 * Solo envía las celdas modificadas; si alguna ya existía pide el motivo de la rectificación (la base lo exige).
 */
export function GrillaCalificaciones(props: {
  grilla: GrillaCalificaciones;
  guardar: (celdas: CeldaEnvio[], motivo: string | null) => Promise<ResultadoGuardado>;
  urlHistorial: string;
  alGuardar?: () => Promise<unknown> | void;
}) {
  const { grilla } = props;
  const { contexto, competencias, alumnos } = grilla;
  const [competenciaId, setCompetenciaId] = useState<string | null>(competencias[0]?.id ?? null);
  const [cambios, setCambios] = useState<Record<string, ValorCelda>>({});
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const editable = contexto.editable;
  const nivelCodigo = contexto.nivelCodigo;

  const valor = (a: AlumnoGrilla, k: string): ValorCelda | null => cambios[clave(a.matriculaId, k)] ?? original(a, k);

  const pendientes = useMemo(() => {
    const lista: CeldaEnvio[] = [];
    for (const a of alumnos) {
      for (const k of competencias) {
        const c = cambios[clave(a.matriculaId, k.id)];
        if (c && !mismo(c, original(a, k.id))) lista.push({ matriculaId: a.matriculaId, competenciaId: k.id, ...c, conclusion: c.conclusion?.trim() || null });
      }
    }
    return lista;
  }, [cambios, alumnos, competencias]);
  const rectificaciones = pendientes.filter((p) => alumnos.find((a) => a.matriculaId === p.matriculaId)?.calificaciones[p.competenciaId]).length;

  // Aviso temprano: la base exige conclusión descriptiva en C (y en B en Primaria) para cerrar el bimestre.
  const aviso = useMemo(() => {
    let sinConclusion = 0;
    let porRegistrar = 0;
    for (const a of alumnos) {
      if (!a.enNomina) continue;
      for (const k of competencias) {
        const v = cambios[clave(a.matriculaId, k.id)] ?? original(a, k.id);
        if (!v) porRegistrar++;
        else if (v.estado === 'evaluada' && requiereConclusion(v.nivelLogro, nivelCodigo) && !v.conclusion?.trim()) sinConclusion++;
      }
    }
    return { sinConclusion, porRegistrar };
  }, [cambios, alumnos, competencias, nivelCodigo]);

  const fijar = (a: AlumnoGrilla, k: string, v: ValorCelda | null) =>
    setCambios((s) => {
      const n = { ...s };
      const o = original(a, k);
      if (v === null || mismo(v, o)) delete n[clave(a.matriculaId, k)];
      else n[clave(a.matriculaId, k)] = v;
      return n;
    });

  async function enviar(m: string | null) {
    setGuardando(true);
    try {
      const r = await props.guardar(pendientes, m);
      toast.success(`Guardado: ${r.insertadas} nueva(s), ${r.rectificadas} rectificada(s)`);
      setCambios({});
      setPidiendoMotivo(false);
      setMotivo('');
      await props.alGuardar?.();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  const competencia = competencias.find((k) => k.id === competenciaId) ?? competencias[0];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {contexto.grado}.º {contexto.seccion} · {contexto.nivel}
          {contexto.asignatura ? ` · ${contexto.asignatura}` : ''}
        </span>
        <span className="text-muted-foreground">
          {contexto.bimestre.numero}.º bimestre ({formatoFecha(contexto.bimestre.inicio)} – {formatoFecha(contexto.bimestre.fin)})
        </span>
        {contexto.cierre ? <BadgeEstado estado={contexto.cierre.estado} /> : <Etiqueta tono="alerta">Registro no abierto</Etiqueta>}
        <div className="ml-auto">
          <HistorialRevisiones url={props.urlHistorial} />
        </div>
      </div>

      {contexto.aviso ? (
        <div role="status" className="flex items-start gap-2 rounded-md border border-alerta bg-alerta/40 px-3 py-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {contexto.aviso}
        </div>
      ) : null}
      {editable && aviso.sinConclusion > 0 ? (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Faltan {aviso.sinConclusion} conclusión(es) descriptiva(s) obligatoria(s) (nivel C{nivelCodigo === 'primaria' ? ' y B en Primaria' : ''}). Sin ellas no se podrá cerrar el bimestre.
        </div>
      ) : null}
      {editable && aviso.porRegistrar > 0 ? (
        <p className="text-sm text-muted-foreground">{aviso.porRegistrar} calificación(es) por registrar de la nómina al cierre del bimestre.</p>
      ) : null}

      {!competencias.length || !alumnos.length ? (
        <EstadoVacio
          titulo={!competencias.length ? 'Sin competencias' : 'Sin estudiantes'}
          descripcion={!competencias.length ? 'El plan de estudios no asigna competencias a este curso.' : 'No hay matrículas en la sección durante el bimestre.'}
        />
      ) : (
        <Tabs defaultValue="competencia">
          <TabsList>
            <TabsTrigger value="competencia">Por competencia</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
          </TabsList>
          <TabsContent value="competencia" className="grid gap-3">
            <div role="tablist" aria-label="Competencias" className="flex gap-2 overflow-x-auto pb-1">
              {competencias.map((k) => (
                <Button
                  key={k.id}
                  role="tab"
                  aria-selected={k.id === competencia?.id}
                  variant={k.id === competencia?.id ? 'default' : 'outline'}
                  size="sm"
                  className="max-w-64 shrink-0"
                  onClick={() => setCompetenciaId(k.id)}
                  title={k.nombre}
                >
                  <span className="truncate">{k.nombre}</span>
                </Button>
              ))}
            </div>
            {competencia ? (
              <p className="text-sm text-muted-foreground">
                {competencia.area ? `${competencia.area} · ` : ''}
                {competencia.codigo}
              </p>
            ) : null}
            <ul className="grid gap-2">
              {competencia
                ? alumnos.map((a) => (
                    <FilaAlumno
                      key={a.matriculaId}
                      alumno={a}
                      valor={valor(a, competencia.id)}
                      original={original(a, competencia.id)}
                      modificado={Boolean(cambios[clave(a.matriculaId, competencia.id)])}
                      editable={editable}
                      nivelCodigo={nivelCodigo}
                      alCambiar={(v) => fijar(a, competencia.id, v)}
                    />
                  ))
                : null}
            </ul>
          </TabsContent>
          <TabsContent value="resumen">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Estudiante</TableHead>
                    {competencias.map((k) => (
                      <TableHead key={k.id} className="min-w-20 text-center" title={k.nombre}>
                        {k.codigo}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alumnos.map((a) => (
                    <TableRow key={a.matriculaId}>
                      <TableCell>
                        {a.apellidos}, {a.nombres}
                        {!a.enNomina ? <span className="ml-1 text-xs text-muted-foreground">(fuera de nómina)</span> : null}
                      </TableCell>
                      {competencias.map((k) => {
                        const v = valor(a, k.id);
                        const falta = v?.estado === 'evaluada' && requiereConclusion(v.nivelLogro, nivelCodigo) && !v.conclusion?.trim();
                        return (
                          <TableCell key={k.id} className="text-center">
                            {v?.estado === 'no_desarrollada' ? <Etiqueta>ND</Etiqueta> : <BadgeNivelLogro nivel={v?.nivelLogro} />}
                            {falta ? <AlertTriangle className="ml-1 inline size-3.5 text-destructive" aria-label="Falta conclusión" /> : null}
                            {cambios[clave(a.matriculaId, k.id)] ? <span className="sr-only">(modificado)</span> : null}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {editable && pendientes.length ? (
        <div className="sticky bottom-0 z-20 rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm" aria-live="polite">
              {pendientes.length} cambio(s) sin guardar{rectificaciones ? ` · ${rectificaciones} rectificación(es)` : ''}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setCambios({})} disabled={guardando}>
                <Undo2 aria-hidden /> Descartar
              </Button>
              <Button onClick={() => (rectificaciones ? setPidiendoMotivo(true) : enviar(null))} disabled={guardando}>
                {guardando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Guardar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={pidiendoMotivo} onOpenChange={(v) => !guardando && setPidiendoMotivo(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo de la rectificación</DialogTitle>
            <DialogDescription>
              Va a modificar {rectificaciones} calificación(es) ya registrada(s). El cambio queda en el historial con su motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="motivo-rectificacion">Motivo</Label>
            <Textarea id="motivo-rectificacion" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: error de digitación, revisión de evidencias…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPidiendoMotivo(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => enviar(motivo.trim())} disabled={guardando || motivo.trim().length < 3}>
              {guardando ? <Loader2 className="animate-spin" aria-hidden /> : null} Guardar rectificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilaAlumno(props: {
  alumno: AlumnoGrilla;
  valor: ValorCelda | null;
  original: ValorCelda | null;
  modificado: boolean;
  editable: boolean;
  nivelCodigo: string;
  alCambiar: (v: ValorCelda | null) => void;
}) {
  const { alumno: a, valor: v } = props;
  const seleccionado = v ? (v.estado === 'no_desarrollada' ? 'ND' : v.nivelLogro) : null;
  const obligatoria = v?.estado === 'evaluada' && requiereConclusion(v.nivelLogro, props.nivelCodigo);
  const falta = obligatoria && !v?.conclusion?.trim();
  const idConclusion = `conclusion-${a.matriculaId}`;
  const nombre = `${a.apellidos}, ${a.nombres}`;

  const elegir = (o: NivelLogro | 'ND') => {
    if (o === seleccionado && props.modificado) return props.alCambiar(null);
    if (o === 'ND') return props.alCambiar({ estado: 'no_desarrollada', nivelLogro: null, conclusion: null });
    props.alCambiar({ estado: 'evaluada', nivelLogro: o, conclusion: v?.conclusion ?? null });
  };

  return (
    <li className={cn('rounded-lg border p-3', props.modificado && 'border-primary', falta && 'border-destructive')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{nombre}</p>
          <p className="text-xs text-muted-foreground">
            {a.codigo}
            {!a.enNomina ? ' · fuera de la nómina al cierre' : ''}
            {props.modificado ? (props.original ? ' · rectificación pendiente' : ' · sin guardar') : ''}
          </p>
        </div>
        <div role="group" aria-label={`Nivel de logro de ${nombre}`} className="flex flex-wrap gap-1">
          {OPCIONES.map((o) => (
            <Button
              key={o.valor}
              type="button"
              size="sm"
              variant={seleccionado === o.valor ? 'default' : 'outline'}
              aria-pressed={seleccionado === o.valor}
              title={o.titulo}
              disabled={!props.editable}
              className="min-w-11"
              onClick={() => elegir(o.valor)}
            >
              {o.texto}
            </Button>
          ))}
        </div>
      </div>
      {v?.estado === 'evaluada' ? (
        <div className="mt-2 grid gap-1">
          <Label htmlFor={idConclusion} className="text-xs">
            Conclusión descriptiva {obligatoria ? <span className="text-destructive">(obligatoria)</span> : <span className="text-muted-foreground">(opcional)</span>}
          </Label>
          <Textarea
            id={idConclusion}
            rows={2}
            value={v.conclusion ?? ''}
            disabled={!props.editable}
            aria-invalid={falta || undefined}
            placeholder="Describa el progreso del estudiante en la competencia"
            onChange={(e) => props.alCambiar({ ...v, conclusion: e.target.value })}
          />
        </div>
      ) : null}
    </li>
  );
}

function textoValor(p: { estado: string; nivel_logro: string | null }) {
  if (p.estado === 'no_desarrollada') return 'ND';
  return p.nivel_logro ?? '—';
}

/** Historial de rectificaciones (revisiones_calificacion, registrado por la base). */
export function HistorialRevisiones({ url }: { url: string }) {
  const [abierto, setAbierto] = useState(false);
  const consulta = useQuery({
    queryKey: ['revisiones', url],
    queryFn: () => api.get<{ revisiones: FilaRevision[] }>(url),
    enabled: abierto,
  });
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History aria-hidden /> Historial
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Historial de rectificaciones</SheetTitle>
          <SheetDescription>Cada cambio de una nota registrada guarda el valor anterior, el nuevo, el autor y el motivo.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 pb-4">
          {consulta.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : consulta.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {mensajeDeError(consulta.error)}
            </p>
          ) : !consulta.data?.revisiones.length ? (
            <EstadoVacio titulo="Sin rectificaciones" descripcion="No se han modificado notas registradas en este bimestre." />
          ) : (
            consulta.data.revisiones.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{r.alumno}</p>
                <p className="text-xs text-muted-foreground">{r.competencia}</p>
                <p className="mt-1">
                  <span className="font-semibold">{textoValor(r.anterior)}</span> → <span className="font-semibold">{textoValor(r.nueva)}</span>
                </p>
                {r.nueva.conclusion !== r.anterior.conclusion ? <p className="mt-1 text-xs">Conclusión: {r.nueva.conclusion ?? '(sin conclusión)'}</p> : null}
                <p className="mt-1 text-xs">Motivo: {r.motivo}</p>
                <p className="text-xs text-muted-foreground">
                  {r.autor} · {formatoFechaHora(r.registrado_en)}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
