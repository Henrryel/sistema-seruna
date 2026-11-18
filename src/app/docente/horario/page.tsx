import type { Metadata } from 'next';
import { EncabezadoPagina, SinPermiso } from '@/components/datos/basicos';
import { GrillaHorario } from '@/components/academico/grilla-horario';
import { FiltroFecha, fechaDeParametro } from '@/components/academico/filtro-fecha';
import { exigirPortalPagina } from '@/server/paginas';
import { ErrorDominio } from '@/server/errores';
import { horarioDocente } from '@/server/services/academico/portales';
import { formatoFecha } from '@/lib/formato';

export const metadata: Metadata = { title: 'Mi horario' };

export default async function PaginaHorarioDocente({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPortalPagina('docente');
  const fecha = fechaDeParametro((await searchParams).fecha);
  let horario: Awaited<ReturnType<typeof horarioDocente>>;
  try {
    horario = await horarioDocente(actor, fecha);
  } catch (e) {
    if (e instanceof ErrorDominio && e.tipo === 'Forbidden') return <SinPermiso mensaje={e.message} />;
    throw e;
  }
  return (
    <>
      <EncabezadoPagina
        titulo="Mi horario"
        descripcion={`Bloques semanales vigentes al ${formatoFecha(horario.fecha)} en todas sus secciones.`}
        acciones={<FiltroFecha fecha={horario.fecha} />}
      />
      <GrillaHorario bloques={horario.bloques} detalle="seccion" />
    </>
  );
}
