'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, hoyLima } from '@/lib/formato';
import type { RespuestaListado } from '@/esquemas/comunes';
import {
  esquemaGenerarJornadas,
  type FilaPolitica,
  type OpcionesGeneracion,
  type ResultadoGeneracion,
  type TipoJornada,
} from '@/esquemas/asistencia/configuracion';

const normal = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

/** Generación masiva de jornadas (secciones de un año o docentes elegidos) para un rango de fechas. */
export function GenerarJornadas(props: { alGenerar: () => Promise<unknown> }) {
  const [abierto, setAbierto] = useState(false);
  const anios = useCatalogo('anios', {}, abierto);
  const [anioId, setAnioId] = useState('');
  const [tipo, setTipo] = useState<TipoJornada>('seccion');
  const [politicaId, setPoliticaId] = useState('');
  const [desde, setDesde] = useState(hoyLima());
  const [hasta, setHasta] = useState(hoyLima());
  const [entrada, setEntrada] = useState('07:45');
  const [salida, setSalida] = useState('13:15');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anioActual = anioId || (anios.data?.find((a) => a.extra?.estado === 'abierto') ?? anios.data?.[0])?.valor || '';
  const politicas = useQuery({
    queryKey: ['politicas-generacion', anioActual],
    queryFn: () => api.get<RespuestaListado<FilaPolitica>>(conConsulta('/api/admin/asistencia/politicas', { anioId: anioActual, porPagina: 200 })),
    enabled: abierto && Boolean(anioActual),
  });
  const opciones = useQuery({
    queryKey: ['opciones-generacion', anioActual],
    queryFn: () => api.get<OpcionesGeneracion>(conConsulta('/api/admin/asistencia/jornadas/opciones', { anioId: anioActual })),
    enabled: abierto && Boolean(anioActual),
  });
  const alcance = tipo === 'seccion' ? 'alumno' : 'docente';
  const listaPoliticas = useMemo(() => (politicas.data?.filas ?? []).filter((p) => p.alcance === alcance), [politicas.data, alcance]);
  const politica = listaPoliticas.find((p) => p.id === politicaId);
  const destinos: { id: string; etiqueta: string; turno?: string }[] =
    tipo === 'seccion' ? (opciones.data?.secciones ?? []) : (opciones.data?.docentes ?? []);

  // Al elegir política: rango = su vigencia (recortado desde hoy) y secciones de su mismo turno.
  useEffect(() => {
    if (!politica) return;
    const hoy = hoyLima();
    if (politica.vigencia_inicio) setDesde(politica.vigencia_inicio > hoy ? politica.vigencia_inicio : hoy);
    if (politica.vigencia_fin) setHasta(politica.vigencia_fin);
    if (tipo === 'seccion') {
      setElegidos(new Set((opciones.data?.secciones ?? []).filter((s) => normal(s.turno) === normal(politica.turno)).map((s) => s.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [politicaId, opciones.data]);

  function alternar(id: string, valor: boolean) {
    setElegidos((s) => {
      const n = new Set(s);
      if (valor) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function enviar() {
    setError(null);
    const datos = { tipo, politicaId, desde, hasta, entrada, salida, seccionIds: tipo === 'seccion' ? [...elegidos] : [], docenteIds: tipo === 'docente' ? [...elegidos] : [] };
    const v = esquemaGenerarJornadas.safeParse(datos);
    if (!v.success) {
      setError(v.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setEnviando(true);
    try {
      const r = await api.post<ResultadoGeneracion>('/api/admin/asistencia/jornadas/generar', v.data);
      toast.success(
        `Se crearon ${r.creadas} jornada(s) en ${r.fechas} fecha(s) ${r.fuente === 'calendario' ? 'lectivas del calendario escolar' : 'de lunes a viernes'}${r.omitidas ? `; ${r.omitidas} ya existían o se superponían` : ''}.`,
      );
      await props.alGenerar();
      setAbierto(false);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus aria-hidden /> Generar jornadas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generar jornadas</DialogTitle>
          <DialogDescription>
            Se crean en los días lectivos del calendario escolar del año; si el calendario no tiene días lectivos, de lunes a viernes sin feriados. Las fechas se
            recortan al año y a la vigencia de la política; las jornadas existentes se omiten.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="gen-anio">Año académico</Label>
            <Select
              value={anioActual || undefined}
              onValueChange={(v) => {
                setAnioId(v);
                setPoliticaId('');
                setElegidos(new Set());
              }}
            >
              <SelectTrigger id="gen-anio" className="w-full">
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
            <Label htmlFor="gen-tipo">Para</Label>
            <Select
              value={tipo}
              onValueChange={(v) => {
                setTipo(v as TipoJornada);
                setPoliticaId('');
                setElegidos(new Set());
              }}
            >
              <SelectTrigger id="gen-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seccion">Secciones (alumnos)</SelectItem>
                <SelectItem value="docente">Docentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="gen-politica">Política</Label>
            <Select value={politicaId || undefined} onValueChange={setPoliticaId}>
              <SelectTrigger id="gen-politica" className="w-full">
                <SelectValue placeholder={politicas.isFetching ? 'Cargando…' : listaPoliticas.length ? 'Seleccione' : `No hay políticas de ${alcance} en el año`} />
              </SelectTrigger>
              <SelectContent>
                {listaPoliticas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.turno} · {formatoFecha(p.vigencia_inicio)}–{formatoFecha(p.vigencia_fin)} · tolerancia {p.tolerancia_minutos} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gen-desde">Desde</Label>
            <Input id="gen-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gen-hasta">Hasta</Label>
            <Input id="gen-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gen-entrada">Hora de entrada</Label>
            <Input id="gen-entrada" type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gen-salida">Hora de salida</Label>
            <Input id="gen-salida" type="time" value={salida} onChange={(e) => setSalida(e.target.value)} />
          </div>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 flex w-full items-center justify-between text-sm font-medium">
            <span>
              {tipo === 'seccion' ? 'Secciones' : 'Docentes'} ({elegidos.size} de {destinos.length})
            </span>
            <span className="flex gap-1">
              <Button type="button" variant="ghost" size="xs" onClick={() => setElegidos(new Set(destinos.map((d) => d.id)))}>
                Todos
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={() => setElegidos(new Set())}>
                Ninguno
              </Button>
            </span>
          </legend>
          <ScrollArea className="h-48 rounded-md border">
            <ul className="grid gap-1 p-2 sm:grid-cols-2">
              {destinos.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <Checkbox id={`dest-${d.id}`} checked={elegidos.has(d.id)} onCheckedChange={(v) => alternar(d.id, v === true)} />
                  <Label htmlFor={`dest-${d.id}`} className="font-normal">
                    {d.etiqueta}
                    {d.turno ? <span className="text-xs text-muted-foreground"> · {d.turno}</span> : null}
                  </Label>
                </li>
              ))}
              {destinos.length === 0 ? <li className="p-2 text-sm text-muted-foreground">Sin {tipo === 'seccion' ? 'secciones activas' : 'docentes activos'}.</li> : null}
            </ul>
          </ScrollArea>
        </fieldset>
        {error ? (
          <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={enviar} disabled={enviando || !politicaId || elegidos.size === 0}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
