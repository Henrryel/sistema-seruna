import type { Metadata } from 'next';
import { exigirPermisoPagina } from '@/server/paginas';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { PERMISOS_VER_LIQUIDACIONES } from '@/esquemas/planilla/permisos';
import { ClienteLiquidaciones } from './cliente';

export const metadata: Metadata = { title: 'Liquidaciones docentes' };

export default async function PaginaLiquidaciones() {
  const actor = await exigirPermisoPagina(PERMISOS_VER_LIQUIDACIONES);
  return (
    <ClienteLiquidaciones
      puedeLiquidar={tienePermiso(actor, 'planilla.liquidar')}
      puedePagar={tienePermiso(actor, 'planilla.pagar')}
      puedeRevertir={tienePermiso(actor, 'planilla.revertir_pago')}
    />
  );
}
