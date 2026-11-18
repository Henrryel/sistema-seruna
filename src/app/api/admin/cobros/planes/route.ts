import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaPlanes, esquemaPlan, type FilaPlan } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaPlanes }, async ({ consulta }) =>
  responderListado<FilaPlan>(consulta, {
    titulo: 'Planes de cobro',
    filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Grado', valor: 'grado' },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Pensión de referencia', valor: 'pension_referencia', formato: 'moneda' },
      { titulo: 'Vigente desde', valor: 'vigente_desde', formato: 'fecha' },
      { titulo: 'Publicado', valor: 'publicado_en', formato: 'fechaHora' },
      { titulo: 'Tramos', valor: 'tramos', formato: 'numero' },
      { titulo: 'Total anual', valor: 'total', formato: 'moneda' },
    ],
    obtener: (p) => servicio.listarPlanes({ q: consulta.q, anioId: consulta.anioId, gradoId: consulta.gradoId, estado: consulta.estado }, p),
  }),
);

export const POST = ruta({ permiso: 'tesoreria.cobrar', cuerpo: esquemaPlan }, async ({ actor, cuerpo }) => servicio.crearPlan(actor, cuerpo));
