'use client';
import { EstadoCuentaPortal } from '@/components/cobros/estado-cuenta';

export function ClientePagosEstudiante() {
  return <EstadoCuentaPortal titulo="Mis pagos" endpoint="/api/estudiante/pagos" urlRecibo={(id) => `/api/estudiante/pagos/recibos/${id}`} />;
}
