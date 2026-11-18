import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaObligaciones, esquemaObligacion, type FilaObligacion } from '@/esquemas/cobros/planes';
import * as servicio from '@/server/services/cobros/planes';

export const GET = ruta({ permiso: 'tesoreria.cobrar', consulta: consultaObligaciones }, async ({ consulta }) =>
  responderListado<FilaObligacion>(consulta, {
    titulo: 'Obligaciones de ingreso',
    filtros: { Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Alumno', valor: 'alumno', ancho: 32 },
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Año de ingreso', valor: 'anio' },
      { titulo: 'Grado', valor: 'grado' },
      { titulo: 'Importe acordado', valor: 'importe_acordado', formato: 'moneda' },
      { titulo: 'Emitido en cuotas', valor: 'emitido', formato: 'moneda' },
      { titulo: 'Condiciones (versión)', valor: 'condiciones_version', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarObligaciones({ q: consulta.q, anioId: consulta.anioId }, p),
  }),
);

export const POST = ruta({ permiso: 'tesoreria.cobrar', cuerpo: esquemaObligacion }, async ({ actor, cuerpo }) => servicio.crearObligacion(actor, cuerpo));
