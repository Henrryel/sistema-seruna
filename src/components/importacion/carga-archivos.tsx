'use client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Etiqueta } from '@/components/datos/badges';
import { api, mensajeDeError } from '@/lib/api';
import { ENTIDADES_IMPORTACION, NOMBRE_ENTIDAD } from '@/esquemas/importacion/lotes';
import { parsearArchivoImportacion } from '@/esquemas/importacion/parseo';

interface ArchivoElegido {
  clave: string;
  archivo: File;
  texto: string;
  entidad: string;
  columnaClave: string;
}

function analizar(a: ArchivoElegido): { filas: number | null; error: string | null } {
  try {
    return { filas: parsearArchivoImportacion(a.texto, a.archivo.name, a.columnaClave).length, error: null };
  } catch (e) {
    return { filas: null, error: e instanceof Error ? e.message : 'No se pudo leer el archivo' };
  }
}

function entidadDesdeNombre(nombre: string): string {
  const base = nombre.toLowerCase().replace(/\.[^.]+$/, '').replace(/[\s-]+/g, '_');
  return ENTIDADES_IMPORTACION.find((e) => base === e || base.endsWith(`_${e}`) || base.startsWith(`${e}_`)) ?? '';
}

/**
 * Diálogo para crear un lote (sistema + archivos + manifiesto) o agregar archivos a un lote en carga.
 * La vista previa (conteos, claves repetidas) se calcula aquí con el mismo lector que usa el servidor;
 * credenciales, anidados y conteos contra el manifiesto los valida la base.
 */
export function CargaArchivos(props: { modo: 'nuevo' | 'agregar'; loteId?: string; alTerminar: (loteId: string) => void | Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [sistema, setSistema] = useState('');
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [conteos, setConteos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const analisis = useMemo(() => archivos.map(analizar), [archivos]);
  const porEntidad = useMemo(() => {
    const m: Record<string, number> = {};
    archivos.forEach((a, i) => {
      if (a.entidad) m[a.entidad] = (m[a.entidad] ?? 0) + (analisis[i]?.filas ?? 0);
    });
    return m;
  }, [archivos, analisis]);

  const reiniciar = () => {
    setSistema('');
    setArchivos([]);
    setConteos({});
  };

  const agregar = async (lista: FileList | null) => {
    if (!lista) return;
    const nuevos = await Promise.all(
      Array.from(lista).map(async (archivo, i) => ({
        clave: `${Date.now()}-${i}-${archivo.name}`,
        archivo,
        texto: await archivo.text(),
        entidad: entidadDesdeNombre(archivo.name),
        columnaClave: 'id',
      })),
    );
    setArchivos((s) => [...s, ...nuevos]);
  };

  const actualizar = (clave: string, cambio: Partial<ArchivoElegido>) => setArchivos((s) => s.map((a) => (a.clave === clave ? { ...a, ...cambio } : a)));

  const listo =
    archivos.length > 0 &&
    archivos.every((a, i) => a.entidad && a.columnaClave.trim() && !analisis[i]?.error) &&
    (props.modo === 'agregar' || sistema.trim().length > 0);

  const enviar = async () => {
    setEnviando(true);
    try {
      const f = new FormData();
      f.set('descriptores', JSON.stringify(archivos.map((a) => ({ entidad: a.entidad, columnaClave: a.columnaClave.trim() }))));
      archivos.forEach((a) => f.append('archivos', a.archivo));
      if (props.modo === 'nuevo') {
        f.set('sistema', sistema);
        const manifiesto = Object.fromEntries(Object.keys(porEntidad).map((e) => [e, Number(conteos[e] ?? porEntidad[e] ?? 0)]));
        f.set('conteos', JSON.stringify(manifiesto));
        const r = await api.post<{ id: string; filas: number }>('/api/admin/reportes/importacion', f);
        toast.success(`Lote ${r.id} creado con ${r.filas} fila(s)`);
        await props.alTerminar(r.id);
      } else {
        const r = await api.post<{ filas: number }>(`/api/admin/reportes/importacion/${props.loteId}/filas`, f);
        toast.success(`${r.filas} fila(s) agregadas`);
        await props.alTerminar(props.loteId ?? '');
      }
      reiniciar();
      setAbierto(false);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) reiniciar();
      }}
    >
      <DialogTrigger asChild>
        {props.modo === 'nuevo' ? (
          <Button>
            <Upload aria-hidden /> Nuevo lote
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <FileUp aria-hidden /> Agregar archivos
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{props.modo === 'nuevo' ? 'Nuevo lote de importación' : `Agregar archivos al lote ${props.loteId}`}</DialogTitle>
          <DialogDescription>
            Archivos JSON (arreglo de objetos planos) o CSV con cabecera, uno por entidad del sistema anterior. Las filas con credenciales o valores
            anidados las rechaza la base.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {props.modo === 'nuevo' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="lote-sistema">Sistema de origen</Label>
              <Input id="lote-sistema" value={sistema} onChange={(e) => setSistema(e.target.value)} placeholder="Ej.: sistema_notas_2019" />
              <p className="text-xs text-muted-foreground">Se guarda en minúsculas. El mismo contenido de un sistema no puede cargarse dos veces.</p>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="lote-archivos">Archivos</Label>
            <Input
              id="lote-archivos"
              type="file"
              multiple
              accept=".json,.csv,.txt,application/json,text/csv"
              onChange={(e) => {
                void agregar(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {archivos.length ? (
            <ul className="grid gap-2">
              {archivos.map((a, i) => {
                const r = analisis[i];
                return (
                  <li key={a.clave} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_12rem_8rem_auto] sm:items-end">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={a.archivo.name}>
                        {a.archivo.name}
                      </p>
                      {r?.error ? (
                        <p className="text-xs text-peligro-foreground" role="alert">
                          {r.error}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{r?.filas ?? 0} fila(s)</p>
                      )}
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs" htmlFor={`entidad-${a.clave}`}>
                        Entidad
                      </Label>
                      <Select value={a.entidad || undefined} onValueChange={(v) => actualizar(a.clave, { entidad: v })}>
                        <SelectTrigger id={`entidad-${a.clave}`} className="w-full">
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTIDADES_IMPORTACION.map((e) => (
                            <SelectItem key={e} value={e}>
                              {NOMBRE_ENTIDAD[e] ?? e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs" htmlFor={`clave-${a.clave}`}>
                        Columna clave
                      </Label>
                      <Input id={`clave-${a.clave}`} value={a.columnaClave} onChange={(e) => actualizar(a.clave, { columnaClave: e.target.value })} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ${a.archivo.name}`}
                      onClick={() => setArchivos((s) => s.filter((x) => x.clave !== a.clave))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {props.modo === 'nuevo' && Object.keys(porEntidad).length ? (
            <fieldset className="grid gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Manifiesto (conteos esperados)</legend>
              <p className="text-xs text-muted-foreground">
                Registre cuántas filas reporta el sistema de origen por entidad. Al sellar el lote la base compara estos conteos con lo cargado.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(porEntidad).map(([e, n]) => (
                  <div key={e} className="flex items-center gap-2">
                    <Label htmlFor={`conteo-${e}`} className="min-w-0 flex-1 truncate text-sm">
                      {NOMBRE_ENTIDAD[e] ?? e}
                    </Label>
                    <Input
                      id={`conteo-${e}`}
                      type="number"
                      min={0}
                      className="w-28"
                      value={conteos[e] ?? String(n)}
                      onChange={(ev) => setConteos((s) => ({ ...s, [e]: ev.target.value }))}
                    />
                    {conteos[e] !== undefined && Number(conteos[e]) !== n ? <Etiqueta tono="alerta">≠ {n}</Etiqueta> : null}
                  </div>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!listo || enviando} onClick={() => void enviar()}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {props.modo === 'nuevo' ? 'Crear lote y cargar' : 'Cargar archivos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
