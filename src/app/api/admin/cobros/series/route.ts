import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaSeries, esquemaSerie, type FilaSerie } from '@/esquemas/cobros/caja';
import * as servicio from '@/server/services/cobros/caja';

export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaSeries }, async ({ consulta }) =>
  responderListado<FilaSerie>(consulta, {
    titulo: 'Series de recibos',
    columnas: [
      { titulo: 'Serie', valor: 'codigo' },
      { titulo: 'Número inicial', valor: 'numero_inicial', formato: 'numero' },
      { titulo: 'Siguiente número', valor: 'siguiente_numero', formato: 'numero' },
      { titulo: 'Recibos emitidos', valor: 'recibos', formato: 'numero' },
      { titulo: 'Activa', valor: 'activa', formato: 'booleano' },
    ],
    obtener: (p) => servicio.listarSeries({ q: consulta.q }, p),
  }),
);

export const POST = ruta({ permiso: 'tesoreria.cobrar', cuerpo: esquemaSerie }, async ({ actor, cuerpo }) => servicio.crearSerie(actor, cuerpo));
