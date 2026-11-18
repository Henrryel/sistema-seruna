'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarX, Clock, FileCheck2, Paperclip, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BadgeEstado } from '@/components/datos/badges';
import { EstadoVacio, Indicador } from '@/components/datos/basicos';
import { DialogoJustificacion } from './dialogo-justificacion';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora, formatoHora } from '@/lib/formato';
import type { FilaDetalleAsistencia, FilaJustificacionPropia, ResumenAsistencia } from '@/esquemas/asistencia/registro';

interface Props {
  /** GET del resumen (ResumenAsistencia). */
  endpoint: string;
  parametros?: Record<string, string>;
  /** Si se indica, permite solicitar justificación (POST multipart) y descargar evidencias (`${endpoint}/{id}/evidencia`). */
  justificar?: { endpoint: string } | null;
  /** "asistencia": indicadores + detalle. "justificaciones": por justificar + solicitudes. */
  vista?: 'asistencia' | 'justificaciones';
  /** Nombre de quien se muestra (apoderado). */
  sujeto?: string;
}

function TablaDetalle(props: { filas: FilaDetalleAsistencia[]; porClase?: boolean; alJustificar?: (f: FilaDetalleAsistencia) => void }) {
  if (props.filas.length === 0) return <EstadoVacio titulo="Sin registros" descripcion="No hay asistencia registrada en el período." />;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            {props.porClase ? <TableHead>Curso</TableHead> : null}
            <TableHead>Estado</TableHead>
            {!props.porClase ? <TableHead className="hidden sm:table-cell">Entrada</TableHead> : null}
            {!props.porClase ? <TableHead className="hidden sm:table-cell">Salida</TableHead> : null}
            <TableHead className="hidden md:table-cell">Justificación</TableHead>
            {props.alJustificar ? <TableHead className="text-right">Acción</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.filas.map((f, i) => (
            <TableRow key={`${f.asistencia_id ?? 'p'}-${f.fecha}-${i}`}>
              <TableCell className="whitespace-nowrap">
                {formatoFecha(f.fecha)}
                {props.porClase && f.hora_inicio ? <span className="ml-1 text-xs text-muted-foreground">{formatoHora(f.hora_inicio)}</span> : null}
              </TableCell>
              {props.porClase ? <TableCell>{f.curso}</TableCell> : null}
              <TableCell>
                <BadgeEstado estado={f.estado} />
              </TableCell>
              {!props.porClase ? <TableCell className="hidden sm:table-cell">{formatoHora(f.entrada)}</TableCell> : null}
              {!props.porClase ? <TableCell className="hidden sm:table-cell">{formatoHora(f.salida)}</TableCell> : null}
              <TableCell className="hidden md:table-cell">{f.justificacion_estado ? <BadgeEstado estado={f.justificacion_estado} /> : '—'}</TableCell>
              {props.alJustificar ? (
                <TableCell className="text-right">
                  {f.justificable ? (
                    <Button size="sm" variant="outline" onClick={() => props.alJustificar?.(f)} aria-label={`Justificar ${f.estado} del ${formatoFecha(f.fecha)}`}>
                      <FileCheck2 aria-hidden /> Justificar
                    </Button>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaSolicitudes(props: { filas: FilaJustificacionPropia[]; evidenciaBase?: string }) {
  if (props.filas.length === 0) return <EstadoVacio titulo="Sin solicitudes" descripcion="Aún no se ha solicitado ninguna justificación." />;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Decisión</TableHead>
            <TableHead className="hidden sm:table-cell">Solicitada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.filas.map((j) => (
            <TableRow key={j.id}>
              <TableCell className="whitespace-nowrap">
                {formatoFecha(j.fecha)}
                {j.curso ? <span className="block text-xs text-muted-foreground">{j.curso}</span> : null}
              </TableCell>
              <TableCell className="max-w-64">
                <p className="line-clamp-3 text-sm">{j.motivo}</p>
                {j.tiene_evidencia && props.evidenciaBase ? (
                  <a className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline" href={`${props.evidenciaBase}/${j.id}/evidencia`}>
                    <Paperclip className="size-3" aria-hidden /> Evidencia
                  </a>
                ) : null}
              </TableCell>
              <TableCell>
                <BadgeEstado estado={j.estado} />
              </TableCell>
              <TableCell className="hidden max-w-64 md:table-cell">
                <p className="line-clamp-3 text-sm">{j.decision ?? '—'}</p>
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                {formatoFechaHora(j.solicitada_en)}
                <span className="block">por {j.solicitante}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Resumen y detalle de asistencia para portales (alumno, apoderado, docente) con solicitud de justificación. */
export function ResumenAsistenciaPortal(props: Props) {
  const qc = useQueryClient();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [justificando, setJustificando] = useState<FilaDetalleAsistencia | null>(null);
  const parametros = { ...props.parametros, desde, hasta };
  const clave = ['asistencia-resumen', props.endpoint, parametros];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<ResumenAsistencia>(conConsulta(props.endpoint, parametros)) });
  const vista = props.vista ?? 'asistencia';
  const r = consulta.data;
  const alJustificar = props.justificar ? setJustificando : undefined;

  const filtros = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="resumen-desde">Desde</Label>
        <Input id="resumen-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="resumen-hasta">Hasta</Label>
        <Input id="resumen-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
      </div>
      {desde || hasta ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDesde('');
            setHasta('');
          }}
        >
          Limpiar
        </Button>
      ) : null}
    </div>
  );

  let contenido;
  if (consulta.isPending) contenido = <Skeleton className="h-64 w-full" />;
  else if (consulta.isError || !r)
    contenido = (
      <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
        {mensajeDeError(consulta.error)}
      </div>
    );
  else if (vista === 'justificaciones') {
    const porJustificar = [...r.diaria, ...r.sesiones].filter((f) => f.justificable);
    contenido = (
      <div className="grid gap-6">
        <section className="grid gap-2" aria-labelledby="titulo-por-justificar">
          <h3 id="titulo-por-justificar" className="font-semibold">
            Inasistencias y tardanzas por justificar
          </h3>
          <TablaDetalle filas={porJustificar} porClase={porJustificar.some((f) => f.curso)} alJustificar={alJustificar} />
        </section>
        <section className="grid gap-2" aria-labelledby="titulo-solicitudes">
          <h3 id="titulo-solicitudes" className="font-semibold">
            Solicitudes
          </h3>
          <TablaSolicitudes filas={r.justificaciones} evidenciaBase={props.justificar?.endpoint} />
        </section>
      </div>
    );
  } else {
    contenido = (
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Indicador titulo="Asistencia" valor={r.porcentaje === null ? '—' : `${r.porcentaje.toLocaleString('es-PE')} %`} icono={<Percent className="size-4" aria-hidden />} />
          <Indicador titulo="Presente" valor={r.totales.presente} icono={<CalendarCheck className="size-4" aria-hidden />} />
          <Indicador titulo="Tarde" valor={r.totales.tarde} icono={<Clock className="size-4" aria-hidden />} />
          <Indicador titulo="Ausente" valor={r.totales.ausente} icono={<CalendarX className="size-4" aria-hidden />} />
          <Indicador titulo="Justificado" valor={r.totales.justificado} icono={<FileCheck2 className="size-4" aria-hidden />} />
        </div>
        <Tabs defaultValue="diaria">
          <TabsList>
            <TabsTrigger value="diaria">Diaria</TabsTrigger>
            {r.sesiones.length > 0 ? <TabsTrigger value="clases">Por clase</TabsTrigger> : null}
            <TabsTrigger value="solicitudes">Justificaciones ({r.justificaciones.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="diaria">
            <TablaDetalle filas={r.diaria} alJustificar={alJustificar} />
          </TabsContent>
          <TabsContent value="clases">
            <TablaDetalle filas={r.sesiones} porClase alJustificar={alJustificar} />
          </TabsContent>
          <TabsContent value="solicitudes">
            <TablaSolicitudes filas={r.justificaciones} evidenciaBase={props.justificar?.endpoint} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {filtros}
      {contenido}
      {props.justificar ? (
        <DialogoJustificacion
          endpoint={props.justificar.endpoint}
          asistenciaId={justificando?.asistencia_id ?? null}
          descripcion={
            justificando
              ? `${justificando.estado === 'tarde' ? 'Tardanza' : 'Inasistencia'} del ${formatoFecha(justificando.fecha)}${justificando.curso ? ` en ${justificando.curso}` : ''}${props.sujeto ? ` · ${props.sujeto}` : ''}.`
              : undefined
          }
          alCerrar={() => setJustificando(null)}
          alEnviar={() => qc.invalidateQueries({ queryKey: ['asistencia-resumen', props.endpoint] })}
        />
      ) : null}
    </div>
  );
}
