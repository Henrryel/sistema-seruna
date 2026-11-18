import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaCalendario, esquemaDiaCalendario, NOMBRE_TIPO_DIA, type FilaDiaCalendario } from '@/esquemas/academico/calendario';
import { NOMBRE_DIA_ISO } from '@/lib/formato';
import * as servicio from '@/server/services/academico/calendario';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaCalendario }, async ({ consulta }) =>
  responderListado<FilaDiaCalendario>(consulta, {
    titulo: 'Calendario escolar',
    filtros: { Tipo: consulta.tipo ? NOMBRE_TIPO_DIA[consulta.tipo] : undefined, Desde: consulta.desde, Hasta: consulta.hasta, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Fecha', valor: 'fecha', formato: 'fecha' },
      { titulo: 'Día', valor: (f) => NOMBRE_DIA_ISO[f.dia_semana] ?? '' },
      { titulo: 'Tipo', valor: (f) => NOMBRE_TIPO_DIA[f.tipo] ?? f.tipo },
      { titulo: 'Descripción', valor: 'descripcion' },
    ],
    obtener: (p) => servicio.listarDias({ anioId: consulta.anioId, tipo: consulta.tipo, desde: consulta.desde, hasta: consulta.hasta, q: consulta.q }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaDiaCalendario }, async ({ actor, cuerpo }) => servicio.crearDia(actor, cuerpo));
