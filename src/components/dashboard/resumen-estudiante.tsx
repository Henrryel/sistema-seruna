'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Lock, Medal, Receipt } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeNivelLogro } from '@/components/datos/badges';
import { EstadoVacio, Indicador } from '@/components/datos/basicos';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoMes, formatoMoneda } from '@/lib/formato';
import type { InicioEstudiante } from '@/esquemas/dashboard/dashboard';

function SinAcceso({ tipo }: { tipo: 'académica' | 'de pagos' }) {
  return (
    <EstadoVacio
      icono={<Lock className="size-8" aria-hidden />}
      titulo="Acceso no autorizado"
      descripcion={`Su vínculo no tiene habilitada la información ${tipo} de este estudiante. Solicítelo en secretaría.`}
    />
  );
}

/** Resumen del estudiante (portal del alumno o de padres: el endpoint aplica el alcance). */
export function ResumenEstudiante({ endpoint, portal }: { endpoint: string; portal: 'estudiante' | 'padre' }) {
  const consulta = useQuery({ queryKey: ['inicio', endpoint], queryFn: () => api.get<InicioEstudiante>(endpoint) });

  if (consulta.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
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
  const m = d.matricula;
  const a = d.asistencia;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {portal === 'padre' ? (
          <>
            <span className="font-medium text-foreground">
              {d.estudiante.nombres} {d.estudiante.apellidos}
            </span>{' '}
            ·{' '}
          </>
        ) : null}
        Código {d.estudiante.codigo}
        {m ? ` · Año ${m.anio} · ${m.grado}.º${m.seccion ? ` ${m.seccion}` : ''} de ${m.nivel}${m.estado !== 'activa' ? ` (${m.estado})` : ''}` : ' · Sin matrícula registrada'}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Medal className="size-4" aria-hidden /> Últimos logros
              </CardTitle>
              <CardDescription>Nivel más reciente publicado por competencia</CardDescription>
            </div>
            {d.accesoAcademico ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/${portal}/notas`}>Ver todos</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {!d.accesoAcademico ? (
              <SinAcceso tipo="académica" />
            ) : !d.logros?.length ? (
              <EstadoVacio titulo="Aún no hay logros publicados" descripcion="Los niveles de logro aparecen cuando el colegio publica el cierre del bimestre." />
            ) : (
              <ul className="divide-y">
                {d.logros.map((l) => (
                  <li key={l.competencia_id} className="flex items-start gap-3 py-2.5">
                    <BadgeNivelLogro nivel={l.nivel_logro} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{l.competencia}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.area ? `${l.area} · ` : ''}
                        {l.bimestre}.º bimestre
                      </p>
                      {l.conclusion ? <p className="mt-1 text-xs text-muted-foreground">{l.conclusion}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4" aria-hidden /> Asistencia del mes
              </CardTitle>
              <CardDescription>{a ? `${formatoMes(a.desde)} (hasta el ${formatoFecha(a.hasta)})` : 'Mes en curso'}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!d.accesoAcademico ? (
                <SinAcceso tipo="académica" />
              ) : !a || a.esperadas === 0 ? (
                <EstadoVacio titulo="Sin registros este mes" />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Indicador titulo="Presente" valor={a.presentes} />
                    <Indicador titulo="Tardanzas" valor={a.tardanzas} />
                    <Indicador titulo="Faltas" valor={a.ausencias} />
                    <Indicador titulo="Justificadas" valor={a.justificadas} />
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/${portal}/asistencia`}>Ver detalle</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4" aria-hidden /> Pagos
              </CardTitle>
              <CardDescription>Saldo de cuotas emitidas</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!d.accesoEconomico || !d.deuda ? (
                <SinAcceso tipo="de pagos" />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Indicador titulo="Deuda total" valor={formatoMoneda(d.deuda.total)} detalle={`${d.deuda.cuotasPendientes} cuota(s) con saldo`} />
                    <Indicador
                      titulo="Vencido"
                      valor={formatoMoneda(d.deuda.vencido)}
                      className={Number(d.deuda.vencido) > 0 ? 'border-peligro-foreground/40' : undefined}
                    />
                  </div>
                  {d.deuda.proximoVencimiento ? (
                    <p className="text-sm text-muted-foreground">
                      Próximo vencimiento: <span className="font-medium text-foreground">{formatoFecha(d.deuda.proximoVencimiento.fecha)}</span> por{' '}
                      <span className="font-medium text-foreground">{formatoMoneda(d.deuda.proximoVencimiento.saldo)}</span>
                    </p>
                  ) : Number(d.deuda.total) <= 0 ? (
                    <p className="text-sm text-muted-foreground">No tiene saldos pendientes.</p>
                  ) : null}
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/${portal}/pagos`}>Ver pagos</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
