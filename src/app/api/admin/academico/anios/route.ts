import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaAnios, esquemaAnio, type FilaAnio } from '@/esquemas/academico/anios';
import * as servicio from '@/server/services/academico/anios';

// Route Handlers FINOS: validar (Zod) → autorizar (permiso) → servicio → responder.

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaAnios }, async ({ consulta }) =>
  responderListado<FilaAnio>(consulta, {
    titulo: 'Años académicos',
    filtros: { Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Inicio', valor: 'inicio', formato: 'fecha' },
      { titulo: 'Fin', valor: 'fin', formato: 'fecha' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Bimestres', valor: 'bimestres', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarAnios({ q: consulta.q, estado: consulta.estado }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaAnio }, async ({ actor, cuerpo }) =>
  servicio.crearAnio(actor, cuerpo),
);
