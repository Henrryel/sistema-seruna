import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaAulas, esquemaAula, type FilaAula } from '@/esquemas/academico/secciones';
import * as servicio from '@/server/services/academico/secciones';

export const GET = ruta({ permiso: 'academico.configurar', consulta: consultaAulas }, async ({ consulta }) =>
  responderListado<FilaAula>(consulta, {
    titulo: 'Aulas',
    filtros: { Activa: consulta.activa === undefined ? undefined : consulta.activa === 'true' ? 'Sí' : 'No', Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Nombre', valor: 'nombre' },
      { titulo: 'Capacidad', valor: 'capacidad', formato: 'numero' },
      { titulo: 'Bloques vigentes', valor: 'bloques', formato: 'numero' },
      { titulo: 'Activa', valor: 'activa', formato: 'booleano' },
    ],
    obtener: (p) => servicio.listarAulas({ q: consulta.q, activa: consulta.activa }, p),
  }),
);

export const POST = ruta({ permiso: 'academico.configurar', cuerpo: esquemaAula }, async ({ actor, cuerpo }) => servicio.crearAula(actor, cuerpo));
