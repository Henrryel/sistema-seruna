import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { PERMISOS_VER_HORAS } from '@/esquemas/planilla/permisos';
import { ClienteHoras } from './cliente';

export const metadata: Metadata = { title: 'Horas docentes' };

export default async function PaginaHoras() {
  const actor = await exigirPermisoPagina(PERMISOS_VER_HORAS);
  return (
    <ClienteHoras
      puedeRegistrar={tienePermiso(actor, 'planilla.horas')}
      puedeResolver={tienePermiso(actor, 'planilla.aprobar_horas')}
    />
  );
}
