'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FilePlus2, Loader2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstadoPago, Etiqueta, estadoPago } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { BuscadorAlumno } from '@/components/cobros/buscador-alumno';
import { api, mensajeDeError } from '@/lib/api';
import { useCatalogo, type Opcion } from '@/lib/catalogos';
import { formatoFecha, formatoFechaHora, formatoMoneda, hoyLima } from '@/lib/formato';
import {
  ETIQUETA_AJUSTE,
  OPCIONES_ESTADO_CUOTA,
  aAjuste,
  descripcionCuota,
  esquemaEmision,
  esquemaFormularioAjuste,
  type FilaAjuste,
  type FilaCuota,
  type ResultadoEmision,
} from '@/esquemas/cobros/cuotas';
import { OPCIONES_CONCEPTO } from '@/esquemas/cobros/planes';
import type { AlumnoBusqueda } from '@/esquemas/cobros/pagos';
import { aCentimos } from '@/esquemas/cobros/dinero';
import { useWatch } from 'react-hook-form';

const ENDPOINT = '/api/admin/cobros/cuotas';

/** Año por defecto: el abierto más reciente o el primero del catálogo. */
function useAnioPorDefecto(anios: Opcion[] | undefined) {
  return useMemo(() => (anios ?? []).find((a) => a.extra?.estado === 'abierto')?.valor ?? anios?.[0]?.valor ?? '', [anios]);
}

export function ClienteCuotas() {
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  const porDefecto = useAnioPorDefecto(anios.data);
  const [anioId, setAnioId] = useState('');
  useEffect(() => {
    if (!anioId && porDefecto) setAnioId(porDefecto);
  }, [anioId, porDefecto]);
  const secciones = useCatalogo('secciones', { anioId }, Boolean(anioId));
  const [ajustando, setAjustando] = useState<FilaCuota | null>(null);
  const hoy = hoyLima();
  const parametros = useMemo(() => ({ anioId }), [anioId]);

  return (
    <>
      <EncabezadoPagina
        titulo="Cuotas"
        descripcion="Cuotas emitidas por matrícula con su saldo (importe + ajustes − abonos). Las cuotas no se editan: se corrigen con ajustes."
        acciones={
          <>
            <Select value={anioId} onValueChange={setAnioId}>
              <SelectTrigger className="w-36" aria-label="Año académico">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {(anios.data ?? []).map((a) => (
                  <SelectItem key={a.valor} value={a.valor}>
                    Año {a.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogoEmision anioId={anioId} anios={anios.data ?? []} grados={grados.data ?? []} />
          </>
        }
      />
      {!anioId ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <TablaDatos<FilaCuota>
          key={anioId}
          endpoint={ENDPOINT}
          parametros={parametros}
          claveFila={(f) => f.id}
          placeholderBusqueda="Buscar alumno o código…"
          filtros={[
            { nombre: 'gradoId', etiqueta: 'Grado', tipo: 'select', opciones: grados.data ?? [] },
            { nombre: 'seccionId', etiqueta: 'Sección', tipo: 'select', opciones: secciones.data ?? [] },
            { nombre: 'concepto', etiqueta: 'Concepto', tipo: 'select', opciones: OPCIONES_CONCEPTO },
            { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO_CUOTA },
          ]}
          columnas={[
            {
              clave: 'alumno',
              titulo: 'Alumno',
              celda: (f) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.alumno}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.codigo} · {f.grado}
                    {f.seccion ? ` "${f.seccion}"` : ''}
                  </p>
                </div>
              ),
            },
            { clave: 'cuota', titulo: 'Cuota', celda: (f) => descripcionCuota(f) },
            { clave: 'vence_en', titulo: 'Vence', celda: (f) => formatoFecha(f.vence_en), ocultarEnMovil: true },
            { clave: 'importe', titulo: 'Importe', celda: (f) => formatoMoneda(f.importe), className: 'text-right', ocultarEnMovil: true },
            { clave: 'ajustes', titulo: 'Ajustes', celda: (f) => (aCentimos(f.ajustes) ? formatoMoneda(f.ajustes) : '—'), className: 'text-right', ocultarEnMovil: true },
            { clave: 'abonado', titulo: 'Abonado', celda: (f) => formatoMoneda(f.abonado), className: 'text-right', ocultarEnMovil: true },
            { clave: 'saldo', titulo: 'Saldo', celda: (f) => <span className="font-semibold tabular-nums">{formatoMoneda(f.saldo)}</span>, className: 'text-right' },
            { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstadoPago estado={estadoPago(f, hoy)} /> },
          ]}
          acciones={(f) => (
            <Button variant="ghost" size="sm" onClick={() => setAjustando(f)} aria-label={`Ajustar ${descripcionCuota(f)} de ${f.alumno}`}>
              <SlidersHorizontal aria-hidden /> <span className="hidden lg:inline">Ajustar</span>
            </Button>
          )}
        />
      )}
      <DialogoAjuste cuota={ajustando} alCerrar={() => setAjustando(null)} />
    </>
  );
}

function CamposAjuste() {
  const tipo = useWatch({ name: 'tipo' }) as string | undefined;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="tipo" etiqueta="Tipo" opciones={Object.entries(ETIQUETA_AJUSTE).map(([valor, etiqueta]) => ({ valor, etiqueta }))} />
      <CampoTexto nombre="monto" etiqueta="Monto (S/)" tipo="number" paso="0.01" />
      {tipo === 'correccion' ? (
        <CampoSelect
          nombre="sentido"
          etiqueta="Sentido de la corrección"
          opciones={[
            { valor: 'disminuir', etiqueta: 'Disminuye el importe' },
            { valor: 'aumentar', etiqueta: 'Aumenta el importe' },
          ]}
          className="sm:col-span-2"
        />
      ) : (
        <p className="text-xs text-muted-foreground sm:col-span-2">Descuentos y exoneraciones siempre disminuyen el saldo.</p>
      )}
      <CampoArea nombre="motivo" etiqueta="Motivo" className="sm:col-span-2" />
    </div>
  );
}

function DialogoAjuste({ cuota, alCerrar }: { cuota: FilaCuota | null; alCerrar: () => void }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const ajustes = useQuery({
    queryKey: ['cobros', 'ajustes', cuota?.id],
    queryFn: () => api.get<{ ajustes: FilaAjuste[] }>(`${ENDPOINT}/${cuota?.id}/ajustes`),
    enabled: Boolean(cuota),
  });
  return (
    <DialogoFormulario
      titulo={cuota ? `Ajustar ${descripcionCuota(cuota)}` : 'Ajustar cuota'}
      descripcion={
        cuota ? (
          <>
            {cuota.alumno} · importe {formatoMoneda(cuota.importe)} · saldo {formatoMoneda(cuota.saldo)}
          </>
        ) : null
      }
      esquema={esquemaFormularioAjuste}
      valores={{ tipo: 'descuento' as const, monto: '', sentido: 'disminuir' as const, motivo: '' }}
      abierto={cuota !== null}
      alCambiarAbierto={(v) => !v && alCerrar()}
      textoEnviar="Registrar ajuste"
      mensajeExito="Ajuste registrado"
      alEnviar={async (d) => {
        await api.post(`${ENDPOINT}/${cuota?.id}/ajustes`, aAjuste(d));
        await qc.invalidateQueries({ queryKey: ['cobros', 'ajustes', cuota?.id] });
        await recargar(ENDPOINT);
      }}
    >
      <CamposAjuste />
      <div className="grid gap-2">
        <p className="text-sm font-medium">Ajustes registrados</p>
        {ajustes.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : (ajustes.data?.ajustes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ajustes.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {(ajustes.data?.ajustes ?? []).map((a) => (
              <li key={a.id} className="rounded-md border px-2 py-1">
                <span className="font-medium">{ETIQUETA_AJUSTE[a.tipo] ?? a.tipo}</span> {formatoMoneda(a.importe)} · {a.motivo}
                <span className="block text-xs text-muted-foreground">
                  {formatoFechaHora(a.registrado_en)} · {a.autorizado_por}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DialogoFormulario>
  );
}

function DialogoEmision({ anioId, anios, grados }: { anioId: string; anios: Opcion[]; grados: Opcion[] }) {
  const recargar = useRecargarListado();
  const [abierto, setAbierto] = useState(false);
  const [alcance, setAlcance] = useState<'seccion' | 'grado' | 'matricula'>('seccion');
  const [anio, setAnio] = useState(anioId);
  const [gradoId, setGradoId] = useState('');
  const [seccionId, setSeccionId] = useState('');
  const [alumno, setAlumno] = useState<AlumnoBusqueda | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEmision | null>(null);
  const secciones = useCatalogo('secciones', { anioId: anio, gradoId: gradoId || undefined }, Boolean(anio));

  useEffect(() => {
    if (abierto) {
      setAnio(anioId);
      setResultado(null);
    }
  }, [abierto, anioId]);

  const emitir = async () => {
    const r = esquemaEmision.safeParse({
      alcance,
      anioId: anio,
      gradoId,
      seccionId: alcance === 'seccion' ? seccionId : undefined,
      matriculaId: alcance === 'matricula' ? alumno?.matricula_id : undefined,
    });
    if (!r.success) {
      toast.error(r.error.issues[0]?.message ?? 'Complete los datos');
      return;
    }
    setEnviando(true);
    try {
      const res = await api.post<ResultadoEmision>(`${ENDPOINT}/emitir`, r.data);
      setResultado(res);
      toast.success(`${res.emitidas} cuota(s) emitida(s)`);
      await recargar(ENDPOINT);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <FilePlus2 aria-hidden /> Emitir cuotas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir cuotas</DialogTitle>
          <DialogDescription>
            Se replican exactamente los tramos del plan publicado y vigente del grado, solo para matrículas activas. Los tramos ya emitidos se omiten.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <RadioGroup value={alcance} onValueChange={(v) => setAlcance(v as typeof alcance)} className="grid grid-cols-3 gap-2" aria-label="Alcance de la emisión">
            {(
              [
                ['seccion', 'Sección'],
                ['grado', 'Grado'],
                ['matricula', 'Un alumno'],
              ] as const
            ).map(([valor, texto]) => (
              <Label key={valor} htmlFor={`alcance-${valor}`} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 has-[[data-state=checked]]:border-primary">
                <RadioGroupItem id={`alcance-${valor}`} value={valor} />
                {texto}
              </Label>
            ))}
          </RadioGroup>
          {alcance === 'matricula' ? (
            <>
              <BuscadorAlumno seleccionado={alumno?.estudiante_id} alSeleccionar={setAlumno} />
              {alumno ? (
                <p className="text-sm">
                  Seleccionado: <span className="font-medium">{alumno.apellidos}, {alumno.nombres}</span>{' '}
                  {alumno.matricula_id ? `· matrícula ${alumno.anio} (${alumno.estado_matricula})` : '· sin matrícula'}
                </p>
              ) : null}
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="emision-anio">Año</Label>
                <Select value={anio} onValueChange={setAnio}>
                  <SelectTrigger id="emision-anio" className="w-full">
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map((a) => (
                      <SelectItem key={a.valor} value={a.valor}>
                        {a.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emision-grado">Grado</Label>
                <Select value={gradoId} onValueChange={setGradoId}>
                  <SelectTrigger id="emision-grado" className="w-full">
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    {grados.map((g) => (
                      <SelectItem key={g.valor} value={g.valor}>
                        {g.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {alcance === 'seccion' ? (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="emision-seccion">Sección</Label>
                  <Select value={seccionId} onValueChange={setSeccionId}>
                    <SelectTrigger id="emision-seccion" className="w-full">
                      <SelectValue placeholder={secciones.isPending ? 'Cargando…' : 'Seleccione'} />
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
              ) : null}
            </div>
          )}
          {resultado ? (
            <div className="grid gap-2 rounded-lg border p-3 text-sm" aria-live="polite">
              <p>
                <span className="font-medium">{resultado.matriculas}</span> matrícula(s) ·{' '}
                <span className="font-medium">{resultado.emitidas}</span> cuota(s) emitida(s) · {resultado.omitidas} omitida(s)
              </p>
              {resultado.avisos.map((a) => (
                <Etiqueta key={a} tono="alerta" className="whitespace-normal">
                  {a}
                </Etiqueta>
              ))}
              {resultado.errores.length ? (
                <ul className="grid gap-1">
                  {resultado.errores.map((e) => (
                    <li key={e.matriculaId} className="rounded-md bg-peligro px-2 py-1 text-peligro-foreground">
                      {e.alumno}: {e.mensaje}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cerrar
          </Button>
          <Button onClick={emitir} disabled={enviando}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Emitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
