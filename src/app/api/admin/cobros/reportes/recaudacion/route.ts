import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaRecaudacion, type FilaRecaudacionDia } from '@/esquemas/cobros/reportes';
import { formatoFecha } from '@/lib/formato';
import * as servicio from '@/server/services/cobros/reportes';

export const runtime = 'nodejs';

/** Recaudación por día y por medio en un rango (JSON o Excel/PDF del detalle diario). */
export const GET = ruta({ permiso: 'reportes.tesoreria', consulta: consultaRecaudacion }, async ({ consulta }) => {
  const datos = await servicio.recaudacion(consulta.desde, consulta.hasta);
  if (consulta.formato === 'json') return datos;
  return responderListado<FilaRecaudacionDia>(
    { pagina: 1, porPagina: 500, formato: consulta.formato },
    {
      titulo: 'Recaudación por día',
      nombreArchivo: `recaudacion-${consulta.desde}-${consulta.hasta}`,
      filtros: { Desde: formatoFecha(consulta.desde), Hasta: formatoFecha(consulta.hasta) },
      horizontal: true,
      columnas: [
        { titulo: 'Fecha', valor: 'fecha', formato: 'fecha' },
        { titulo: 'Pagos', valor: 'pagos', formato: 'numero' },
        { titulo: 'Efectivo', valor: 'efectivo', formato: 'moneda' },
        { titulo: 'Transferencia', valor: 'transferencia', formato: 'moneda' },
        { titulo: 'Yape', valor: 'yape', formato: 'moneda' },
        { titulo: 'Plin', valor: 'plin', formato: 'moneda' },
        { titulo: 'Tarjeta', valor: 'tarjeta', formato: 'moneda' },
        { titulo: 'Otro', valor: 'otro', formato: 'moneda' },
        { titulo: 'Cobrado', valor: 'cobrado', formato: 'moneda' },
        { titulo: 'Revertido', valor: 'revertido', formato: 'moneda' },
        { titulo: 'Devuelto', valor: 'devuelto', formato: 'moneda' },
        { titulo: 'Neto', valor: 'neto', formato: 'moneda' },
      ],
      obtener: async () => ({ filas: datos.porDia, total: datos.porDia.length }),
    },
  );
});
