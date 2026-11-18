'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ClipboardList, NotebookPen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EstadoVacio, Indicador } from '@/components/datos/basicos';
import { api, mensajeDeError } from '@/lib/api';
import { NOMBRE_DIA_ISO, formatoFecha } from '@/lib/formato';
import type { InicioDocente } from '@/esquemas/dashboard/dashboard';

function nombreDia(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return NOMBRE_DIA_ISO[d === 0 ? 7 : d] ?? '';
}

export function InicioDocentePanel() {
  const consulta = useQuery({ queryKey: ['inicio-docente'], queryFn: () => api.get<InicioDocente>('/api/docente/inicio') });

  if (consulta.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }
  if (consulta.isError) {
    return (
      <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
        {mensajeDeError(consulta.error)}
      </div>
    );
  }
  const d = consulta.data;
  const totalPendientes = d.pendientes.reduce((s, p) => s + p.pendientes, 0);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Indicador titulo="Cursos asignados" valor={d.cursos} icono={<ClipboardList className="size-4" aria-hidden />} />
        <Indicador titulo="Clases hoy" valor={d.clases.length} icono={<CalendarClock className="size-4" aria-hidden />} />
        <Indicador titulo="Notas pendientes" valor={totalPendientes} icono={<NotebookPen className="size-4" aria-hidden />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clases de hoy</CardTitle>
            <CardDescription>
              {nombreDia(d.fecha)} {formatoFecha(d.fecha)}
              {d.clases.length && d.origenClases === 'horario' ? ' · según el horario semanal' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {d.clases.length === 0 ? (
              <EstadoVacio titulo="Sin clases programadas" descripcion="Hoy no tiene sesiones ni bloques de horario." />
            ) : (
              <ol className="grid gap-2">
                {d.clases.map((c) => (
                  <li key={`${c.origen}-${c.id}`} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="w-20 shrink-0 text-sm font-semibold tabular-nums">
                      {c.hora_inicio}
                      <span className="block text-xs font-normal text-muted-foreground">a {c.hora_fin}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.asignatura}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.grado}.º {c.seccion} · {c.nivel}
                        {c.aula ? ` · ${c.aula}` : ''}
                      </p>
                    </div>
                    {c.estado ? <BadgeEstado estado={c.estado} /> : <Etiqueta tono="info">Horario</Etiqueta>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Calificaciones pendientes</CardTitle>
              <CardDescription>Cierres en borrador con competencias sin nota</CardDescription>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/docente/calificaciones">Calificar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {d.pendientes.length === 0 ? (
              <EstadoVacio titulo="Todo al día" descripcion="No tiene competencias pendientes de calificar en cierres abiertos." />
            ) : (
              <ul className="grid gap-2">
                {d.pendientes.map((p) => {
                  const avance = p.esperadas ? Math.round((100 * (p.esperadas - p.pendientes)) / p.esperadas) : 0;
                  return (
                    <li key={`${p.cierre_id}-${p.curso_id}`} className="grid gap-2 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.asignatura}</p>
                          <p className="text-sm text-muted-foreground">
                            {p.bimestre}.º bimestre · {p.grado}.º {p.seccion} {p.nivel}
                          </p>
                        </div>
                        <Etiqueta tono="alerta">{p.pendientes} pendiente(s)</Etiqueta>
                      </div>
                      <Progress value={avance} aria-label={`Avance de ${p.asignatura} ${p.grado}.º ${p.seccion}: ${avance} %`} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
