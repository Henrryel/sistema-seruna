import type { Metadata } from 'next';
import { BookOpen, CalendarClock, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { FiltroFecha, fechaDeParametro } from '@/components/academico/filtro-fecha';
import { exigirPortalPagina } from '@/server/paginas';
import { ErrorDominio } from '@/server/errores';
import { misCursos } from '@/server/services/academico/portales';
import { NOMBRE_FUNCION } from '@/esquemas/academico/asignaciones';
import { formatoFecha } from '@/lib/formato';

export const metadata: Metadata = { title: 'Mis cursos' };

export default async function PaginaMisCursos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPortalPagina('docente');
  const fecha = fechaDeParametro((await searchParams).fecha);
  let datos: Awaited<ReturnType<typeof misCursos>>;
  try {
    datos = await misCursos(actor, fecha);
  } catch (e) {
    if (e instanceof ErrorDominio && e.tipo === 'Forbidden') return <SinPermiso mensaje={e.message} />;
    throw e;
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Mis cursos"
        descripcion={`Cursos con asignación vigente al ${formatoFecha(datos.fecha)}. Solo ve las secciones que tiene asignadas.`}
        acciones={<FiltroFecha fecha={datos.fecha} />}
      />
      {datos.cursos.length === 0 ? (
        <EstadoVacio titulo="Sin cursos vigentes" descripcion="No tiene asignaciones vigentes en esta fecha. Consulte con coordinación académica." icono={<BookOpen className="size-8" aria-hidden />} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {datos.cursos.map((c) => (
            <li key={c.asignacion_id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">{c.asignatura}</CardTitle>
                  <CardDescription>{c.seccion}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                  <Etiqueta tono={c.funcion === 'titular' ? 'info' : 'neutro'}>{NOMBRE_FUNCION[c.funcion] ?? c.funcion}</Etiqueta>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="size-4" aria-hidden /> {c.alumnos} estudiante(s)
                  </span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {datos.otras.length > 0 ? (
        <section aria-labelledby="otras-asignaciones" className="mt-8 grid gap-3">
          <h3 id="otras-asignaciones" className="flex items-center gap-2 font-semibold">
            <CalendarClock className="size-4" aria-hidden /> Otras asignaciones (pasadas o próximas)
          </h3>
          <ul className="grid gap-2">
            {datos.otras.map((a) => (
              <li key={a.asignacion_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  <span className="font-medium">{a.asignatura}</span> · {a.seccion}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {NOMBRE_FUNCION[a.funcion] ?? a.funcion} · {formatoFecha(a.inicio)} – {formatoFecha(a.fin)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
