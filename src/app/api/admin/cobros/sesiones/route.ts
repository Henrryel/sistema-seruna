import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaSesiones, esquemaAbrirSesion, type FilaSesion } from '@/esquemas/cobros/caja';
import * as servicio from '@/server/services/cobros/caja';

export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaSesiones }, async ({ consulta }) =>
  responderListado<FilaSesion>(consulta, {
    titulo: 'Sesiones de caja',
    filtros: { Estado: consulta.estado, Desde: consulta.desde, Hasta: consulta.hasta },
    horizontal: true,
    columnas: [
      { titulo: 'Caja', valor: 'caja' },
      { titulo: 'Operador', valor: 'operador' },
      { titulo: 'Apertura', valor: 'abierta_en', formato: 'fechaHora' },
      { titulo: 'Cierre', valor: 'cerrada_en', formato: 'fechaHora' },
      { titulo: 'Saldo inicial', valor: 'saldo_inicial', formato: 'moneda' },
      { titulo: 'Esperado', valor: 'esperado', formato: 'moneda' },
      { titulo: 'Contado', valor: 'saldo_contado', formato: 'moneda' },
      { titulo: 'Diferencia', valor: 'diferencia', formato: 'moneda' },
    ],
    obtener: (p) => servicio.listarSesiones({ cajaId: consulta.cajaId, estado: consulta.estado, desde: consulta.desde, hasta: consulta.hasta }, p),
  }),
);

/** Abre una sesión de caja para el operador actual. */
export const POST = ruta({ permiso: 'tesoreria.cobrar', cuerpo: esquemaAbrirSesion }, async ({ actor, cuerpo }) => servicio.abrirSesion(actor, cuerpo));
