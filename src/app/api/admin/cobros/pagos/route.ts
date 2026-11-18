import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { ETIQUETA_MEDIO, consultaPagos, esquemaPago, type FilaPago } from '@/esquemas/cobros/pagos';
import { numeroRecibo } from '@/esquemas/cobros/dinero';
import * as servicio from '@/server/services/cobros/pagos';

export const GET = ruta({ permiso: ['tesoreria.cobrar', 'tesoreria.revertir'], consulta: consultaPagos }, async ({ consulta }) =>
  responderListado<FilaPago>(consulta, {
    titulo: 'Pagos y recibos',
    filtros: { Desde: consulta.desde, Hasta: consulta.hasta, Medio: consulta.medio, Estado: consulta.estado, Búsqueda: consulta.q },
    horizontal: true,
    columnas: [
      { titulo: 'Fecha', valor: 'pagado_en', formato: 'fechaHora' },
      { titulo: 'Recibo', valor: (f) => (f.recibo_id ? numeroRecibo(f.serie, f.numero) : '') },
      { titulo: 'Alumno', valor: 'alumno', ancho: 28 },
      { titulo: 'Pagante', valor: 'pagante_nombre', ancho: 24 },
      { titulo: 'Medio', valor: (f) => ETIQUETA_MEDIO[f.medio_ui] },
      { titulo: 'Referencia', valor: 'referencia' },
      { titulo: 'Importe', valor: 'importe', formato: 'moneda' },
      { titulo: 'Devuelto', valor: 'devuelto', formato: 'moneda' },
      { titulo: 'Estado', valor: (f) => (f.revertido ? 'Revertido' : 'Vigente') },
      { titulo: 'Cajero', valor: 'registrado_por' },
    ],
    obtener: (p) =>
      servicio.listarPagos(
        {
          q: consulta.q,
          desde: consulta.desde,
          hasta: consulta.hasta,
          medio: consulta.medio,
          estado: consulta.estado,
          estudianteId: consulta.estudianteId,
          sesionId: consulta.sesionId,
        },
        p,
      ),
  }),
);

/** Registra el pago, sus aplicaciones y el recibo en una sola transacción (idempotente por clave). */
export const POST = ruta({ permiso: 'tesoreria.cobrar', cuerpo: esquemaPago }, async ({ actor, cuerpo }) => servicio.registrarPago(actor, cuerpo));
