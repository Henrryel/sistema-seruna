'use client';
import { useMemo } from 'react';
import { EstadoCuentaPortal } from '@/components/cobros/estado-cuenta';

export function ClientePagosPadre({ estudianteId }: { estudianteId: string }) {
  const parametros = useMemo(() => ({ estudianteId }), [estudianteId]);
  return (
    <EstadoCuentaPortal
      key={estudianteId}
      endpoint="/api/padre/pagos"
      parametros={parametros}
      urlRecibo={(id) => `/api/padre/pagos/recibos/${id}?estudianteId=${encodeURIComponent(estudianteId)}`}
    />
  );
}
