import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaAreas, esquemaArea, type FilaArea } from '@/esquemas/academico/curriculo';
import * as servicio from '@/server/services/academico/curriculo';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaAreas }, async ({ consulta }) =>
  responderListado<FilaArea>(consulta, {
    titulo: 'Áreas curriculares',
    filtros: { Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Nombre', valor: 'nombre' },
      { titulo: 'Asignaturas', valor: 'asignaturas', formato: 'numero' },
      { titulo: 'Competencias', valor: 'competencias', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarAreas({ q: consulta.q }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaArea }, async ({ actor, cuerpo }) => servicio.crearArea(actor, cuerpo));
