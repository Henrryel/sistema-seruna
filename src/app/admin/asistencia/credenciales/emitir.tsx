'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IdCard, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Etiqueta } from '@/components/datos/badges';
import { api, ApiError, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { sumarDias, hoyLima } from '@/lib/formato';
import { esquemaEmitirCredenciales, type ModoEmision, type PersonaCredencial } from '@/esquemas/asistencia/credenciales';

/** POST que descarga un archivo (el PDF de carnets) en lugar de JSON. */
async function descargarPost(url: string, cuerpo: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-seruna': '1', 'Content-Type': 'application/json', Accept: 'application/pdf, application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) {
    const datos = (await res.json().catch(() => null)) as { error?: { tipo?: string; mensaje?: string } } | null;
    throw new ApiError(res.status, datos?.error?.tipo ?? 'Error', datos?.error?.mensaje ?? `Error ${res.status}`);
  }
  const blob = await res.blob();
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'carnets.pdf';
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 60_000);
  return { emitidas: Number(res.headers.get('X-Credenciales-Emitidas') ?? 0), revocadas: Number(res.headers.get('X-Credenciales-Revocadas') ?? 0) };
}

export interface PersonaElegida {
  persona_id: string;
  nombre: string;
  detalle: string | null;
}

/**
 * Emisión de credenciales e impresión de carnets en el mismo paso (el token no se puede recuperar
 * después). `inicial` permite abrirlo ya con personas elegidas (reimpresión = reemisión).
 */
export function EmitirCredenciales(props: { abierto: boolean; alCambiarAbierto: (v: boolean) => void; inicial?: PersonaElegida[]; alEmitir: () => Promise<unknown> }) {
  const [modo, setModo] = useState<ModoEmision>('seccion');
  const anios = useCatalogo('anios', {}, props.abierto);
  const [anioId, setAnioId] = useState('');
  const anioActual = anioId || (anios.data?.find((a) => a.extra?.estado === 'abierto') ?? anios.data?.[0])?.valor || '';
  const anio = anios.data?.find((a) => a.valor === anioActual);
  const secciones = useCatalogo('secciones', { anioId: anioActual }, props.abierto && Boolean(anioActual));
  const [seccionId, setSeccionId] = useState('');
  const [personas, setPersonas] = useState<PersonaElegida[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [expiraEn, setExpiraEn] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.abierto) return;
    setError(null);
    if (props.inicial?.length) {
      setModo('personas');
      setPersonas(props.inicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.abierto]);

  useEffect(() => {
    const fin = typeof anio?.extra?.fin === 'string' ? anio.extra.fin : null;
    setExpiraEn(fin && fin >= hoyLima() ? fin : sumarDias(hoyLima(), 365));
  }, [anio?.extra?.fin]);

  const resultados = useQuery({
    queryKey: ['personas-credencial', busqueda],
    queryFn: () => api.get<{ personas: PersonaCredencial[] }>(conConsulta('/api/admin/asistencia/credenciales/personas', { q: busqueda })),
    enabled: props.abierto && modo === 'personas' && busqueda.trim().length >= 2,
  });

  async function emitir() {
    setError(null);
    const datos = { modo, seccionId: modo === 'seccion' ? seccionId : undefined, personaIds: modo === 'personas' ? personas.map((p) => p.persona_id) : [], docenteIds: [], expiraEn };
    const v = esquemaEmitirCredenciales.safeParse(datos);
    if (!v.success) {
      setError(v.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setEnviando(true);
    try {
      const r = await descargarPost('/api/admin/asistencia/credenciales/emitir', v.data);
      toast.success(
        `Se emitieron ${r.emitidas} credencial(es)${r.revocadas ? ` y se revocaron ${r.revocadas} anterior(es)` : ''}. Imprima o guarde el PDF ahora: los códigos no se pueden recuperar.`,
        { duration: 10_000 },
      );
      await props.alEmitir();
      setPersonas([]);
      props.alCambiarAbierto(false);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={props.abierto} onOpenChange={props.alCambiarAbierto}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emitir credenciales y carnets</DialogTitle>
          <DialogDescription>
            Se genera un código nuevo por persona (QR y Code 128 con el mismo código) y se descarga el PDF de carnets tamaño CR80. La base guarda solo una
            huella (hash) del código: si pierde el PDF, deberá reemitir. Emitir revoca las credenciales anteriores.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={modo} onValueChange={(v) => setModo(v as ModoEmision)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="seccion">Por sección</TabsTrigger>
            <TabsTrigger value="docentes">Docentes</TabsTrigger>
            <TabsTrigger value="personas">Personas</TabsTrigger>
          </TabsList>
          <TabsContent value="seccion" className="grid gap-3 pt-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="em-anio">Año académico</Label>
              <Select
                value={anioActual || undefined}
                onValueChange={(v) => {
                  setAnioId(v);
                  setSeccionId('');
                }}
              >
                <SelectTrigger id="em-anio" className="w-full">
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {(anios.data ?? []).map((a) => (
                    <SelectItem key={a.valor} value={a.valor}>
                      {a.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="em-seccion">Sección</Label>
              <Select value={seccionId || undefined} onValueChange={setSeccionId}>
                <SelectTrigger id="em-seccion" className="w-full">
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {(secciones.data ?? []).map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">Incluye a los alumnos activos con matrícula confirmada en la sección (vigente o próxima).</p>
          </TabsContent>
          <TabsContent value="docentes" className="pt-2">
            <p className="text-sm text-muted-foreground">Se emitirán carnets para todos los docentes activos. Para algunos, use la pestaña «Personas».</p>
          </TabsContent>
          <TabsContent value="personas" className="grid gap-3 pt-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar alumno o docente por nombre o código…" className="pl-8" aria-label="Buscar persona" />
            </div>
            {busqueda.trim().length >= 2 ? (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border" aria-label="Resultados">
                {(resultados.data?.personas ?? []).map((p) => {
                  const ya = personas.some((x) => x.persona_id === p.persona_id);
                  return (
                    <li key={p.persona_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">{p.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.perfil === 'alumno' ? 'Alumno' : 'Docente'} · {p.codigo}
                          {p.detalle && p.perfil === 'alumno' ? ` · ${p.detalle}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {p.credencial_vigente ? <Etiqueta tono="info">Con credencial</Etiqueta> : null}
                        <Button size="xs" variant="outline" disabled={ya} onClick={() => setPersonas((l) => [...l, { persona_id: p.persona_id, nombre: p.nombre, detalle: p.detalle }])}>
                          {ya ? 'Agregado' : 'Agregar'}
                        </Button>
                      </span>
                    </li>
                  );
                })}
                {resultados.data && resultados.data.personas.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</li> : null}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2" aria-label="Personas elegidas">
              {personas.map((p) => (
                <span key={p.persona_id} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                  {p.nombre}
                  <button type="button" aria-label={`Quitar a ${p.nombre}`} onClick={() => setPersonas((l) => l.filter((x) => x.persona_id !== p.persona_id))}>
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              {personas.length === 0 ? <span className="text-sm text-muted-foreground">Aún no eligió personas.</span> : null}
            </div>
          </TabsContent>
        </Tabs>
        <div className="grid max-w-xs gap-1.5">
          <Label htmlFor="em-vence">Válida hasta (inclusive)</Label>
          <Input id="em-vence" type="date" min={hoyLima()} value={expiraEn} onChange={(e) => setExpiraEn(e.target.value)} />
        </div>
        {error ? (
          <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => props.alCambiarAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={emitir} disabled={enviando || (modo === 'seccion' && !seccionId) || (modo === 'personas' && personas.length === 0)}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <IdCard aria-hidden />}
            Emitir y descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
