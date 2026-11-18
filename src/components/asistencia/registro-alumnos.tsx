'use client';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCheck, FileDown, FileSpreadsheet, Loader2, Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeEstado } from '@/components/datos/badges';
import { EstadoVacio } from '@/components/datos/basicos';
import { SelectorEstado } from './estado';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoHora } from '@/lib/formato';
import type { RespuestaListado } from '@/esquemas/comunes';
import type { EstadoManual, FilaAsistenciaAlumno, JornadaSeccionInfo, ResultadoLote, SesionInfo } from '@/esquemas/asistencia/registro';

type Respuesta = RespuestaListado<FilaAsistenciaAlumno> & { jornada?: JornadaSeccionInfo | null; sesion?: SesionInfo };

/**
 * Toma/corrección de asistencia de alumnos: diaria por sección (`modo="diaria"`, envía `jornadaId`) o por
 * sesión de clase (`modo="sesion"`). Los cambios se guardan juntos con un motivo (obligatorio en la base);
 * cada fila que la base rechaza se informa sin deshacer las demás.
 */
export function RegistroAlumnos(props: { endpoint: string; parametros?: Record<string, string>; modo: 'diaria' | 'sesion' }) {
  const qc = useQueryClient();
  const clave = ['asistencia-registro', props.endpoint, props.parametros ?? {}];
  const consulta = useQuery({
    queryKey: clave,
    queryFn: () => api.get<Respuesta>(conConsulta(props.endpoint, { ...props.parametros, porPagina: 200 })),
  });
  const [cambios, setCambios] = useState<Record<string, EstadoManual>>({});
  const [motivo, setMotivo] = useState(props.modo === 'sesion' ? 'Asistencia tomada en clase' : 'Registro de asistencia diaria');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const filas = useMemo(() => consulta.data?.filas ?? [], [consulta.data]);
  const jornada = consulta.data?.jornada;
  const sesion = consulta.data?.sesion;
  const sinJornada = props.modo === 'diaria' ? jornada === null : sesion ? !sesion.jornada_id : false;
  const pendientes = filas.filter((f) => f.estado === 'pendiente' && !cambios[f.matricula_id]);
  const nCambios = Object.keys(cambios).length;
  const exportar = (formato: 'xlsx' | 'pdf') => conConsulta(props.endpoint, { ...props.parametros, formato });

  async function guardar() {
    const registros = Object.entries(cambios).map(([matriculaId, estado]) => ({ matriculaId, estado }));
    if (registros.length === 0 || motivo.trim().length === 0) return;
    setGuardando(true);
    try {
      const cuerpo = props.modo === 'diaria' ? { jornadaId: jornada?.id, motivo, registros } : { motivo, registros };
      const r = await api.post<ResultadoLote>(props.endpoint, cuerpo);
      const errs = Object.fromEntries(r.errores.map((e) => [e.matriculaId, e.mensaje]));
      setErrores(errs);
      setCambios((c) => Object.fromEntries(Object.entries(c).filter(([k]) => errs[k])));
      if (r.errores.length === 0) toast.success(`Asistencia guardada (${r.guardados} cambio(s))`);
      else toast.warning(`Se guardaron ${r.guardados}; ${r.errores.length} con observaciones (vea el detalle en la lista)`);
      await qc.invalidateQueries({ queryKey: clave });
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  if (consulta.isPending) return <Skeleton className="h-48 w-full" />;
  if (consulta.isError) {
    return (
      <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
        {mensajeDeError(consulta.error)}
      </div>
    );
  }
  if (sinJornada) {
    return (
      <EstadoVacio
        titulo="No hay jornada programada"
        descripcion="La sección no tiene una jornada programada en esa fecha. Genérela en Políticas y jornadas (o elija otra fecha)."
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground">
          {jornada ? (
            <>
              <span className="font-medium text-foreground">{jornada.seccion}</span> · Jornada {formatoHora(jornada.entrada)}–{formatoHora(jornada.salida)} · tolerancia{' '}
              {jornada.tolerancia_minutos} min{jornada.admite_manual ? '' : ' · la política exige marcación QR para registrar presencia'}
            </>
          ) : sesion ? (
            <>
              <span className="font-medium text-foreground">{sesion.curso}</span> · {sesion.seccion} · {formatoHora(sesion.hora_inicio)}–{formatoHora(sesion.hora_fin)} ·{' '}
              {sesion.docente}
              {sesion.admite_manual ? '' : ' · la política no admite registro manual de presencia'}
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={exportar('xlsx')} download>
              <FileSpreadsheet aria-hidden /> Excel
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={exportar('pdf')} download>
              <FileDown aria-hidden /> PDF
            </a>
          </Button>
        </div>
      </div>

      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" descripcion="No hay matrículas confirmadas en la sección para esa fecha." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pendientes.length === 0}
              onClick={() => setCambios((c) => ({ ...c, ...Object.fromEntries(pendientes.map((f) => [f.matricula_id, 'presente' as const])) }))}
            >
              <CheckCheck aria-hidden /> Pendientes como presentes ({pendientes.length})
            </Button>
            {nCambios > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setCambios({})}>
                <Undo2 aria-hidden /> Descartar cambios
              </Button>
            ) : null}
          </div>
          <ul className="divide-y rounded-lg border" aria-label="Estudiantes">
            {filas.map((f, i) => {
              const elegido = cambios[f.matricula_id];
              const error = errores[f.matricula_id];
              return (
                <li key={f.matricula_id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <span className="mr-2 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                      {f.estudiante}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{f.codigo}</span>
                      <BadgeEstado estado={f.estado} />
                      {f.entrada ? <span>Entrada {formatoHora(f.entrada)}</span> : null}
                      {f.salida ? <span>Salida {formatoHora(f.salida)}</span> : null}
                      {f.justificacion ? <span>Justificación {f.justificacion}</span> : null}
                      {elegido && elegido !== f.estado ? <span className="font-medium text-foreground">→ {elegido}</span> : null}
                    </p>
                    {error ? (
                      <p role="alert" className="mt-1 text-xs text-peligro-foreground">
                        {error}
                      </p>
                    ) : null}
                  </div>
                  <SelectorEstado
                    etiqueta={`Asistencia de ${f.estudiante}`}
                    valor={elegido ?? f.estado}
                    deshabilitado={f.estado === 'justificado'}
                    alCambiar={(e) =>
                      setCambios((c) => {
                        const nuevo = { ...c };
                        if (e === f.estado) delete nuevo[f.matricula_id];
                        else nuevo[f.matricula_id] = e;
                        return nuevo;
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="motivo-registro">Motivo del registro o corrección</Label>
              <Input id="motivo-registro" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button onClick={guardar} disabled={guardando || nCambios === 0 || motivo.trim().length === 0}>
              {guardando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Guardar {nCambios > 0 ? `(${nCambios})` : ''}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
