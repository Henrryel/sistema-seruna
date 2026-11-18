import type { Metadata } from 'next';
import { CalendarX } from 'lucide-react';
import { EncabezadoPagina, EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { GrillaHorario } from '@/components/academico/grilla-horario';
import { FiltroFecha, fechaDeParametro } from '@/components/academico/filtro-fecha';
import { exigirPortalPagina } from '@/server/paginas';
import { ErrorDominio } from '@/server/errores';
import { horarioEstudiante } from '@/server/services/academico/portales';
import { formatoFecha } from '@/lib/formato';

export const metadata: Metadata = { title: 'Mi horario' };

export default async function PaginaHorarioEstudiante({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPortalPagina('estudiante');
  const fecha = fechaDeParametro((await searchParams).fecha);
  let horario: Awaited<ReturnType<typeof horarioEstudiante>>;
  try {
    horario = await horarioEstudiante(actor, fecha);
  } catch (e) {
    if (e instanceof ErrorDominio && e.tipo === 'Forbidden') return <SinPermiso mensaje={e.message} />;
    throw e;
  }
  return (
    <>
      <EncabezadoPagina
        titulo="Mi horario"
        descripcion={horario.seccion ? `${horario.seccion.etiqueta} · turno ${horario.seccion.turno} · vigente al ${formatoFecha(horario.fecha)}` : undefined}
        acciones={<FiltroFecha fecha={horario.fecha} />}
      />
      {horario.seccion ? (
        <GrillaHorario bloques={horario.bloques} />
      ) : (
        <EstadoVacio
          titulo="Sin sección asignada"
          descripcion="No tiene una matrícula vigente con sección en esta fecha."
          icono={<CalendarX className="size-8" aria-hidden />}
        />
      )}
    </>
  );
}
