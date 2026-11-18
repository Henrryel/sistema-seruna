import type { Metadata } from 'next';
import { CalendarX, Users } from 'lucide-react';
import { EncabezadoPagina, EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { GrillaHorario } from '@/components/academico/grilla-horario';
import { FiltroFecha, fechaDeParametro } from '@/components/academico/filtro-fecha';
import { exigirPortalPagina, hijoSeleccionado } from '@/server/paginas';
import { ErrorDominio } from '@/server/errores';
import { horarioHijo } from '@/server/services/academico/portales';
import { formatoFecha } from '@/lib/formato';

export const metadata: Metadata = { title: 'Horario' };

export default async function PaginaHorarioHijo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPortalPagina('padre');
  const fecha = fechaDeParametro((await searchParams).fecha);
  const { hijo } = await hijoSeleccionado(actor);
  if (!hijo) {
    return (
      <EstadoVacio titulo="Sin estudiantes vinculados" descripcion="No tiene un vínculo vigente con ningún estudiante." icono={<Users className="size-8" aria-hidden />} />
    );
  }
  let horario: Awaited<ReturnType<typeof horarioHijo>>;
  try {
    // Valida el vínculo vigente (acceso básico) antes de mostrar datos del menor.
    horario = await horarioHijo(actor, hijo.estudianteId, fecha);
  } catch (e) {
    if (e instanceof ErrorDominio && e.tipo === 'Forbidden') return <SinPermiso mensaje={e.message} />;
    throw e;
  }
  return (
    <>
      <EncabezadoPagina
        titulo={`Horario de ${hijo.nombres}`}
        descripcion={horario.seccion ? `${horario.seccion.etiqueta} · turno ${horario.seccion.turno} · vigente al ${formatoFecha(horario.fecha)}` : undefined}
        acciones={<FiltroFecha fecha={horario.fecha} />}
      />
      {horario.seccion ? (
        <GrillaHorario bloques={horario.bloques} />
      ) : (
        <EstadoVacio titulo="Sin sección asignada" descripcion="El estudiante no tiene una matrícula vigente con sección en esta fecha." icono={<CalendarX className="size-8" aria-hidden />} />
      )}
    </>
  );
}
